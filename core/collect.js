// Runs every enabled collector, then classifies, scores and de-duplicates.

import { SECTORS, UNIVERSITY_RE } from './config.js';
import {
  adzunaSearch, planAdzunaQueries, rssCollect, workdayCollect,
  greenhouseCollect, leverCollect, normaliseJob,
} from './collectors.js';

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
export function scoreJob(j, profile) {
  const text = words(`${j.title} ${j.description}`);
  const title = words(j.title);
  const kws = [...new Set([...(profile.fieldKeywords || []), ...(profile.skills || [])].map(words))].filter(Boolean);
  if (!kws.length) return 0;
  let pts = 0;
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
    raw.push(...(await run(feed.name, () => rssCollect(fetchFn, feed))).map((j) => normaliseJob('rss', { ...j, market: feed.market, university: feed.university, sector: feed.sector })));

  for (const site of sources.workday || [])
    for (const kw of (profile.fieldKeywords || []).slice(0, 3)) {
      raw.push(...(await run(`${site.name}: ${kw}`, () => workdayCollect(fetchFn, site, kw))).map((j) => normaliseJob('workday', { ...j, market: site.market, university: site.university })));
      await sleep(Math.min(throttleMs, 1000));
    }

  for (const b of sources.greenhouse || [])
    raw.push(...(await run(`Greenhouse: ${b.name || b.slug}`, () => greenhouseCollect(fetchFn, b))).map((j) => normaliseJob('greenhouse', { ...j, market: b.market || 'IN', sector: b.sector, university: b.university })));
  for (const b of sources.lever || [])
    raw.push(...(await run(`Lever: ${b.name || b.slug}`, () => leverCollect(fetchFn, b))).map((j) => normaliseJob('lever', { ...j, market: b.market || 'IN', sector: b.sector, university: b.university })));

  return { jobs: finalise(raw, profile), report };
}

const POSTDOC_RE = /\bpost[- ]?doc|\bpostdoctoral|\bpost[- ]doctoral|\bfellow \(post ?doc\)/i;

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
    if (exclude.some((x) => words(j.title).includes(x))) continue;
    // University listings must name one of her target roles (postdoc by default).
    if (j.category === 'university' && profile.universityRolesOnly !== false && !isTargetRole(j.title, profile)) continue;
    const key = words(`${j.title}|${j.company}`).replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.set(key, { ...j, score: scoreJob(j, profile) });
  }
  return [...seen.values()].sort((a, b) => b.score - a.score || String(b.postedAt).localeCompare(String(a.postedAt)));
}
