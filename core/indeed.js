// Indeed, through Indeed's own Claude connector (tools search_jobs and get_job_details).
// The connector answers in Markdown; these functions turn it into listings.

import { normaliseJob } from './collectors.js';

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

// The searches to run for her: US postdocs in her fields, and the India sector searches.
export function indeedSearches(profile = {}) {
  const fields = (profile.fieldKeywords || []).slice(0, 3);
  const us = [...new Set(['botany', ...fields])].map((f) => ({ search: `postdoctoral ${f}`, location: 'United States', country: 'US', market: 'US' }));
  const india = [...new Set(Object.values(profile.sectorQueries || {}).flat())].slice(0, 6)
    .map((q) => ({ search: q, location: 'India', country: 'IN', market: 'IN' }));
  return [...us, ...india];
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
    university: search.market !== 'IN' && /\b(universit|college|institute|national laborator|usda|agricultural research service|botanical garden)/i.test(j.company),
  });
  return { ...n, id: `indeed:${hash(`${j.title}|${j.company}|${j.location}`.toLowerCase())}`, jobId: j.jobId };
}
