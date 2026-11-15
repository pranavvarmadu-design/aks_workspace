// Job collectors. Each returns an array of normalised jobs:
// { id, source, title, company, location, url, description, postedAt,
//   market, university, sector, salary }
// Only licensed APIs and feeds/endpoints the publishers expose for reuse are
// used here. LinkedIn and Indeed are never fetched automatically.

import { MARKETS, UNIVERSITY_RE, marketOf } from './config.js';

export const stripHtml = (s = '') =>
  String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(amp;)+/g, '&') // feeds often double-encode
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/<(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

const hash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

const iso = (d) => {
  const t = d ? new Date(d) : null;
  return t && !isNaN(t) ? t.toISOString() : null;
};

const job = (source, j) => ({
  id: `${source}:${hash(j.url || j.title + j.company)}`,
  source,
  title: stripHtml(j.title || ''),
  company: stripHtml(j.company || ''),
  location: stripHtml(j.location || ''),
  url: j.url || '',
  description: stripHtml(j.description || '').slice(0, 6000),
  postedAt: iso(j.postedAt),
  market: j.market || null,
  university: !!j.university,
  sector: j.sector || null,
  salary: j.salary || '',
  ...(j.feed ? { feed: j.feed } : {}),
  ...(j.broadFeed ? { broadFeed: true } : {}),
  ...(j.closes ? { closes: j.closes } : {}),
});

async function getJson(fetchFn, url, init) {
  const res = await fetchFn(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

// ---- Adzuna (licensed aggregator API; free key from developer.adzuna.com) ----

export async function adzunaSearch(fetchFn, { appId, appKey, country, what, whatOr, maxDaysOld = 30, resultsPerPage = 50 }) {
  const p = new URLSearchParams({
    app_id: appId, app_key: appKey, results_per_page: String(resultsPerPage),
    what, max_days_old: String(maxDaysOld), sort_by: 'date', 'content-type': 'application/json',
  });
  if (whatOr) p.set('what_or', whatOr);
  const data = await getJson(fetchFn, `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${p}`);
  return (data.results || []).map((r) => ({
    title: r.title,
    company: r.company?.display_name,
    location: r.location?.display_name,
    url: r.redirect_url,
    description: r.description,
    postedAt: r.created,
    salary: r.salary_min ? `${Math.round(r.salary_min)}${r.salary_max && r.salary_max !== r.salary_min ? '-' + Math.round(r.salary_max) : ''}` : '',
  }));
}

// Plans the Adzuna queries for a profile: universities per market, sectors for India.
export function planAdzunaQueries(profile) {
  const plan = [];
  const fields = (profile.fieldKeywords || []).slice(0, 4);
  const roles = (profile.academicRoles || []).join(' ');
  for (const [market, m] of Object.entries(MARKETS))
    for (const country of m.adzuna)
      for (const what of fields) plan.push({ country, what, whatOr: roles, market, university: true });
  for (const [sector, queries] of Object.entries(profile.sectorQueries || {}))
    for (const what of queries.slice(0, 3)) plan.push({ country: 'in', what, market: 'IN', sector });
  return plan;
}

// ---- RSS / Atom ----

export function parseFeed(xml) {
  const items = [];
  const tag = (block, name) => {
    const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
    return m ? m[1].trim() : '';
  };
  for (const m of xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)) {
    const b = m[0];
    const link = tag(b, 'link') || (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || tag(b, 'guid');
    items.push({
      title: stripHtml(tag(b, 'title')),
      link: stripHtml(link),
      description: tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'),
      pubDate: tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published'),
    });
  }
  return items;
}

export async function rssCollect(fetchFn, feed) {
  const res = await fetchFn(feed.url, { headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(feed.url).host}`);
  return parseFeed(await res.text()).map((it) => {
    // HigherEdJobs puts "Employer (City, ST)" in the description.
    const d = stripHtml(it.description);
    const m = d.length < 160 && d.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    // Employer career feeds (SAP SuccessFactors) put the place in the title: "Analyst (Vikhroli, Maharashtra, India)".
    if (feed.format === 'madgex') {
      // "Employer: Job title"; description lines: salary, employer, summary, location (last).
      const [employer, ...rest] = it.title.split(/:\s+/);
      const lines = d.split('\n').map((x) => x.trim()).filter(Boolean);
      const location = lines.at(-1) || '';
      const summary = lines.filter((x, i) => i !== lines.length - 1 && !x.endsWith(':') && x.replace(/:$/, '') !== employer).join(' ');
      return { title: rest.join(': ') || it.title, company: employer, location, url: it.link.replace(/&amp;/g, '&').replace(/\?TrackID.*$/, ''), postedAt: it.pubDate, description: summary, market: marketOf(location) || feed.market };
    }
    const t = feed.employer && it.title.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
    if (t) return { title: t[1], url: it.link.replace(/&amp;/g, '&').replace(/[?&]feedId=.*$/, ''), postedAt: it.pubDate, company: feed.employer, location: t[2], description: d };
    return {
      title: it.title, url: it.link, postedAt: it.pubDate.replace(/ EST$/, ' -0500').replace(/ EDT$/, ' -0400'),
      company: m ? m[1] : feed.employer || feed.name, location: m ? m[2] : '', description: m ? '' : d,
    };
  });
}

// ---- Employer career sites on SAP SuccessFactors (jobs2web), via their RSS search feeds ----

export const employerFeedUrl = (site, keyword) => `${site.base.replace(/\/+$/, '')}/services/rss/job/?locale=en_US&keywords=${encodeURIComponent(keyword)}`;

// ---- SmartRecruiters public postings API ----

export async function smartRecruitersCollect(fetchFn, board) {
  const p = new URLSearchParams({ limit: '100' });
  if (board.country) p.set('country', board.country);
  const data = await getJson(fetchFn, `https://api.smartrecruiters.com/v1/companies/${board.company}/postings?${p}`);
  return (data.content || []).map((j) => ({
    title: j.name,
    company: board.name || j.company?.name || board.company,
    location: j.location?.fullLocation || [j.location?.city, j.location?.country].filter(Boolean).join(', '),
    url: `https://jobs.smartrecruiters.com/${board.company}/${j.id}`,
    description: [j.department?.label, j.function?.label, j.experienceLevel?.label].filter(Boolean).join(' · '),
    postedAt: j.releasedDate,
  }));
}

// ---- Workday career sites ----

export async function workdayCollect(fetchFn, site, searchText) {
  const base = `https://${site.host}`;
  const data = await getJson(fetchFn, `${base}/wday/cxs/${site.tenant}/${site.site}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText }),
  });
  return (data.jobPostings || []).map((p) => ({
    title: p.title,
    company: site.name,
    location: p.locationsText,
    url: `${base}/en-US/${site.site}${p.externalPath}`,
    description: (p.bulletFields || []).join(' '),
    postedAt: workdayDate(p.postedOn),
  }));
}

function workdayDate(s = '') {
  const m = s.match(/(\d+)\+?\s+days?/i);
  const days = /today/i.test(s) ? 0 : /yesterday/i.test(s) ? 1 : m ? Number(m[1]) : null;
  return days == null ? null : new Date(Date.now() - days * 864e5).toISOString();
}

// ---- Greenhouse and Lever public job-board APIs ----

export async function greenhouseCollect(fetchFn, board) {
  const data = await getJson(fetchFn, `https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs?content=true`);
  return (data.jobs || []).map((j) => ({
    title: j.title, company: board.name || board.slug, location: j.location?.name,
    url: j.absolute_url, description: j.content, postedAt: j.updated_at,
  }));
}

export async function leverCollect(fetchFn, board) {
  const data = await getJson(fetchFn, `https://api.lever.co/v0/postings/${board.slug}?mode=json`);
  return (data || []).map((j) => ({
    title: j.text, company: board.name || board.slug, location: j.categories?.location,
    url: j.hostedUrl, description: j.descriptionPlain || j.description, postedAt: j.createdAt,
  }));
}

export { job as normaliseJob, UNIVERSITY_RE };

// ---- jobs.ac.uk: the UK academic jobs board (Oxford, Cambridge, John Innes, Kew and most UK
// universities and institutes, plus some in Europe). Its robots.txt allows search pages. ----

export const jobsAcUkUrl = (keyword) =>
  `https://www.jobs.ac.uk/search/?keywords=${encodeURIComponent(keyword)}&sortOrder=1&pageSize=100`;

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
// "05 Nov" -> ISO date. A date more than aheadDays after today belongs to last year
// (a posting date is never in the future; a closing date can be months ahead).
export function dayMonthToIso(s, today = new Date(), aheadDays = 7) {
  const m = String(s).trim().match(/^(\d{1,2})\s+([A-Za-z]{3})/);
  if (!m || !(m[2].toLowerCase() in MONTHS)) return '';
  let d = new Date(Date.UTC(today.getUTCFullYear(), MONTHS[m[2].toLowerCase()], Number(m[1])));
  if (d - today > aheadDays * 864e5) d = new Date(Date.UTC(today.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate()));
  return d.toISOString().slice(0, 10);
}
// Closing dates are in the future: a day and month already well past means next year.
export function closingToIso(s, today = new Date()) {
  const iso = dayMonthToIso(s, today, 366);
  if (!iso) return '';
  const d = new Date(iso);
  if (today - d > 30 * 864e5) d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function parseJobsAcUk(html, today = new Date()) {
  const out = [];
  const blocks = String(html).split(/<div class="j-search-result__result\b/).slice(1);
  for (const b of blocks) {
    const link = b.match(/<a href="(https:\/\/www\.jobs\.ac\.uk\/job\/([A-Z0-9]+)\/[^"]*)">\s*([\s\S]*?)\s*<\/a>/);
    if (!link) continue;
    const text = (re) => stripHtml((b.match(re) || [])[1] || '').replace(/\s+/g, ' ').trim();
    const department = text(/j-search-result__department">([\s\S]*?)<\/div>/);
    const company = text(/j-search-result__employer">([\s\S]*?)<\/div>/);
    const location = text(/<div>\s*Location:([\s\S]*?)<\/div>/);
    const salary = text(/<strong>Salary:\s*<\/strong>([\s\S]*?)<\/div>/);
    const placed = text(/<strong>Date Placed:\s*<\/strong>([\s\S]*?)<\/div>/);
    const closes = text(/j-search-result__date--blue\s*">([\s\S]*?)<\/span>/);
    out.push({
      id: `jac${link[2]}`, title: stripHtml(link[3]).replace(/\s+/g, ' ').trim(), url: link[1].replace(/^(https:\/\/www\.jobs\.ac\.uk\/job\/[A-Z0-9]+)\/.*$/, '$1'),
      company, location, department, salary, postedAt: dayMonthToIso(placed, today), closes: closingToIso(closes, today),
      description: [department, salary].filter(Boolean).join('. '),
    });
  }
  return out;
}

export async function jobsAcUkCollect(fetchFn, keyword, today = new Date()) {
  const res = await fetchFn(jobsAcUkUrl(keyword), { headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from www.jobs.ac.uk`);
  // UK board: a location it does not recognise is still in the UK or Europe.
  return parseJobsAcUk(await res.text(), today).map((j) => ({ ...j, market: marketOf(j.location) || 'EMEA', university: true }));
}
