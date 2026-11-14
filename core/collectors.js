// Job collectors. Each returns an array of normalised jobs:
// { id, source, title, company, location, url, description, postedAt,
//   market, university, sector, salary }
// Only licensed APIs and feeds/endpoints the publishers expose for reuse are
// used here. LinkedIn and Indeed are never fetched automatically.

import { MARKETS, UNIVERSITY_RE } from './config.js';

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
    return {
      title: it.title, url: it.link, postedAt: it.pubDate.replace(/ EST$/, ' -0500').replace(/ EDT$/, ' -0400'),
      company: m ? m[1] : feed.name, location: m ? m[2] : '', description: m ? '' : d,
    };
  });
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
