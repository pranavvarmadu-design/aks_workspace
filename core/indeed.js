// Indeed, through Indeed's own Claude connector (tools search_jobs and get_job_details).
// The connector answers in Markdown; these functions turn it into listings.

import { normaliseJob } from './collectors.js';
import { INDEED_COUNTRIES, UNIVERSITY_RE } from './config.js';

const FIELD = (block, name) => (block.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`)) || [])[1]?.trim() || '';
const na = (v) => (v === 'N/A' ? '' : v);

// Text of a connector result, whichever shape it comes in.
export function resultText(r) {
  const p = r?.payload ?? r;
  if (typeof p === 'string') return p;
  if (typeof p?.result === 'string') return p.result;
  return (r?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
}

// search_jobs Markdown -> [{ jobId, title, company, location, postedAt, jobType, salary, url }]
export function parseIndeedList(md = '') {
  return md.split(/\n\s*\n(?=\*\*Job Title:\*\*)/).map((b) => ({
    jobId: FIELD(b, 'Job Id'),
    title: FIELD(b, 'Job Title'),
    company: FIELD(b, 'Company'),
    location: FIELD(b, 'Location'),
    postedAt: FIELD(b, 'Posted on'),
    jobType: na(FIELD(b, 'Job Type')),
    salary: na(FIELD(b, 'Compensation')),
    url: FIELD(b, 'View Job URL'),
  })).filter((j) => j.title && j.jobId);
}

// get_job_details Markdown -> the posting text after the header fields.
export function parseIndeedDetail(md = '') {
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length && (/^\s*(###|\*\*[^*]+:\*\*)/.test(lines[i]) || !lines[i].trim())) i++;
  return lines.slice(i).join('\n').replace(/[ \t]+/g, ' ').trim();
}

// The searches for one segment of the page.
// 'university': postdoc-level roles in every country Indeed serves, in each country's own wording.
// 'industry': the India sector searches.
export function indeedSearches(profile = {}, kind = 'university') {
  if (kind === 'industry')
    return [...new Set(['research scientist agriculture', ...Object.values(profile.sectorQueries || {}).flat()])].slice(0, 10)
      .map((q) => ({ search: q, location: 'India', country: 'IN', market: 'IN' }));
  const out = [];
  for (const c of INDEED_COUNTRIES) {
    const roles = c.style === 'fellow' ? ['research fellow', 'postdoctoral'] : c.style === 'postdoc' ? ['postdoc'] : ['postdoctoral'];
    const fields = c.code === 'US' ? [...new Set(['plant', 'botany', ...(profile.fieldKeywords || []).slice(0, 2)])] : ['plant'];
    for (const r of roles) for (const f of fields) out.push({ search: `${r} ${f}`, location: c.name, country: c.code, market: c.market });
  }
  return out;
}

const hash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

// A listing ready for finalise(). Indeed's short links change on every call, so the id
// comes from title, employer and place instead.
export function indeedToRaw(j, search) {
  const n = normaliseJob('Indeed', {
    title: j.title, company: j.company, location: j.location, url: j.url,
    postedAt: j.postedAt, salary: j.salary, description: j.description || '',
    market: search.market,
    university: search.market !== 'IN' && (UNIVERSITY_RE.test(j.company) || /\b(usda|agricultural research service)/i.test(j.company)),
  });
  return { ...n, id: `indeed:${hash(`${j.title}|${j.company}|${j.location}`.toLowerCase())}`, jobId: j.jobId };
}
