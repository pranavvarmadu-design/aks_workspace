// Runs every enabled collector, then classifies, scores and de-duplicates.

import { coreSkillMatches } from './screen.js';
import { SECTORS, UNIVERSITY_RE } from './config.js';
import { isIndia } from './screen.js';
import {
  adzunaSearch, planAdzunaQueries, rssCollect, workdayCollect,
  greenhouseCollect, leverCollect, normaliseJob, employerFeedUrl, smartRecruitersCollect, jobsAcUkCollect } from './collectors.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const words = (s) => String(s).toLowerCase();

export function detectSector(text) {
  const t = words(text);
  let best = null, bestHits = 0;
  for (const [key, s] of Object.entries(SECTORS)) {
    const hits = s.terms.filter((term) => t.includes(term)).length;
    if (hits > bestHits) [best, bestHits] = [key, hits];
  }
  return best;
}

// 0-100: how many of the profile's keywords appear in the listing.
// True when term appears at the start of a word in text ('neuro' matches 'neuroscience', not 'aneurysm').
export const startsWord = (text, term) =>
  new RegExp(`(^|[^a-z0-9])${term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(String(text).toLowerCase());

export function scoreJob(j, profile) {
  const text = words(`${j.title} ${j.description}`);
  const title = words(j.title);
  const kws = [...new Set([...(profile.fieldKeywords || []), ...(profile.skills || [])].map(words))].filter(Boolean);
  // Field words in the title count even when the full description is not available.
  const terms = profile.relevanceTerms || [];
  // A title in her field counts most; a generic title from a feed in her field still counts a little.
  const field = terms.filter((t) => startsWord(title, t)).length + 0.5 * Math.min(1, terms.filter((t) => startsWord(j.feed || '', t)).length);
  if (!kws.length) return Math.min(100, field * 25);
  let pts = field * 1.5;
  for (const k of kws) {
    if (title.includes(k)) pts += 2;
    else if (text.includes(k)) pts += 1;
    else if (k.includes(' ') && k.split(' ').every((w) => text.includes(w))) pts += 0.5;
  }
  return Math.min(100, Math.round((pts / Math.min(kws.length, 6)) * 50));
}

// Assigns category 'university' | 'industry' | null (null = dropped).
export function classify(j) {
  if (j.market === 'IN') {
    // The listing's own wording wins over the search that happened to find it.
    const sector = detectSector(`${j.title} ${j.description}`) || j.sector;
    return sector ? { ...j, category: 'industry', sector } : null;
  }
  if (j.university || UNIVERSITY_RE.test(j.company)) return { ...j, category: 'university', university: true };
  return null;
}

export async function collectAll({ fetchFn = fetch, profile, sources, keys = {}, throttleMs = 2500, onProgress = () => {} }) {
  const raw = [];
  const report = [];
  const run = async (name, fn) => {
    try {
      const got = await fn();
      report.push({ source: name, ok: true, count: got.length });
      return got;
    } catch (e) {
      report.push({ source: name, ok: false, error: String(e.message || e) });
      return [];
    } finally {
      onProgress(name);
    }
  };

  if (sources.adzuna?.enabled && keys.adzunaAppId && keys.adzunaAppKey) {
    for (const q of planAdzunaQueries(profile)) {
      const got = await run(`Adzuna ${q.country.toUpperCase()}: ${q.what}`, () =>
        adzunaSearch(fetchFn, {
          appId: keys.adzunaAppId, appKey: keys.adzunaAppKey, country: q.country, what: q.what,
          whatOr: q.whatOr, maxDaysOld: sources.adzuna.maxDaysOld, resultsPerPage: sources.adzuna.resultsPerPage,
        }));
      // Adzuna university queries return companies too; classify() filters by employer.
      raw.push(...got.map((j) => normaliseJob('adzuna', { ...j, market: q.market, sector: q.sector })));
      await sleep(throttleMs);
    }
  } else if (sources.adzuna?.enabled) {
    report.push({ source: 'Adzuna', ok: false, error: 'No Adzuna API key set (free at developer.adzuna.com). SG, EMEA and India listings need it.' });
  }

  for (const feed of sources.rss || [])
    raw.push(...(await run(feed.name, () => rssCollect(fetchFn, feed))).map((j) => normaliseJob('rss', { ...j, market: j.market || feed.market, university: feed.university, sector: feed.sector, feed: feed.name.replace(/^HigherEdJobs:\s*/, ''), broadFeed: feed.broad })));

  for (const kw of sources.jobsAcUk || []) {
    raw.push(...(await run(`jobs.ac.uk: ${kw}`, () => jobsAcUkCollect(fetchFn, kw))).map((j) => normaliseJob('jobs.ac.uk', j)));
    await sleep(Math.min(throttleMs, 1500));
  }

  for (const kw of sources.scienceCareers || []) {
    const feed = { name: `Science Careers: ${kw}`, url: `https://jobs.sciencecareers.org/jobsrss/?keywords=${encodeURIComponent(kw)}`, format: 'madgex', market: 'US', university: true };
    raw.push(...(await run(feed.name, () => rssCollect(fetchFn, feed))).map((j) => normaliseJob('Science Careers', { ...j, university: true })));
    await sleep(Math.min(throttleMs, 1500));
  }

  for (const site of sources.workday || [])
    for (const kw of (profile.fieldKeywords || []).slice(0, 3)) {
      raw.push(...(await run(`${site.name}: ${kw}`, () => workdayCollect(fetchFn, site, kw))).map((j) => normaliseJob('workday', { ...j, market: site.market, university: site.university })));
      await sleep(Math.min(throttleMs, 1000));
    }

  for (const b of sources.greenhouse || [])
    raw.push(...(await run(`Greenhouse: ${b.name || b.slug}`, () => greenhouseCollect(fetchFn, b))).map((j) => normaliseJob('greenhouse', { ...j, market: b.market || 'IN', sector: b.sector, university: b.university })));
  // India industry: employers' own career sites. Only their India postings are kept.
  const indiaOnly = (list, source, extra) => list
    .map((j) => normaliseJob(source, { ...j, ...extra }))
    .filter((j) => isIndia({ location: j.location }))
    .map((j) => ({ ...j, market: 'IN' }));
  for (const site of sources.employerFeeds || []) {
    for (const kw of site.keywords || sources.employerKeywords || ['research']) {
      const feed = { name: site.name, employer: site.name, url: employerFeedUrl(site, kw) };
      raw.push(...indiaOnly(await run(`${site.name}: ${kw}`, () => rssCollect(fetchFn, feed)), 'employer', { sector: site.sector }));
      await sleep(Math.min(throttleMs, 1500));
    }
  }
  for (const b of sources.smartrecruiters || [])
    raw.push(...indiaOnly(await run(`${b.name}: careers`, () => smartRecruitersCollect(fetchFn, b)), 'employer', { sector: b.sector }));
  for (const site of sources.workdayIndustry || []) {
    raw.push(...indiaOnly(await run(`${site.name}: India`, () => workdayCollect(fetchFn, site, 'India')), 'employer', { sector: site.sector }));
    await sleep(Math.min(throttleMs, 1000));
  }

  for (const b of sources.lever || [])
    raw.push(...(await run(`Lever: ${b.name || b.slug}`, () => leverCollect(fetchFn, b))).map((j) => normaliseJob('lever', { ...j, market: b.market || 'IN', sector: b.sector, university: b.university })));

  return { jobs: finalise(raw, profile), report };
}

// 'Research fellow' and 'research associate' are the postdoc titles in the UK, Singapore and the Commonwealth.
const POSTDOC_RE = /\bpost[- ]?doc|\bpostdoctoral|\bpost[- ]doctoral|\bfellow \(post ?doc\)|\bresearch fellow|\bresearch associate|\bwissenschaftliche[rs]? mitarbeiter/i;

export function isTargetRole(title, profile) {
  const t = words(title);
  if (POSTDOC_RE.test(title)) return true;
  return (profile.academicRoles || []).some((r) => r && !/post/i.test(r) && t.includes(words(r)));
}

export function finalise(raw, profile) {
  const exclude = (profile.excludeTerms || []).map(words).filter(Boolean);
  const seen = new Map();
  for (const r of raw) {
    const j = classify(r);
    if (!j || !j.title || !j.url) continue;
    // A title that names her field is never dropped ('Biosystems Engineering & Soil Science' stays).
    const inField = (profile.relevanceTerms || []).some((t) => startsWord(j.title, t));
    if (!inField && exclude.some((x) => startsWord(j.title, x))) continue;
    // All-subject feeds: keep only titles in her field or naming one of her core skills.
    if (j.broadFeed && !inField && !coreSkillMatches({ title: j.title }).some((c) => c.inTitle)) continue;
    if ((profile.alwaysExcludeTerms || []).some((x) => startsWord(j.title, x))) continue;
    if (j.category === 'industry' && (profile.industryExcludeTerms || []).some((x) => startsWord(j.title, x))) continue;
    // University listings must name one of her target roles (postdoc by default).
    if (j.category === 'university' && profile.universityRolesOnly !== false && !isTargetRole(j.title, profile)) continue;
    const key = words(`${j.title}|${j.company}`).replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.set(key, { ...j, score: scoreJob(j, profile) });
  }
  return [...seen.values()].sort((a, b) => b.score - a.score || String(b.postedAt).localeCompare(String(a.postedAt)));
}
