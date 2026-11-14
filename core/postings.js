// Reads individual posting pages so visa sponsorship and requirements can be checked.
// Polite by design: obeys robots.txt, reads one page at a time with a pause, and
// never reads the same posting twice. Works in Node and in the extension service worker.

import { stripHtml } from './collectors.js';

// Hosts whose terms forbid automated access; never read automatically.
const NEVER = /(^|\.)(linkedin\.com|indeed\.[a-z.]+|naukri\.com|glassdoor\.[a-z.]+)$/i;

const robotsCache = new Map();

// Disallow rules for "User-agent: *" from a robots.txt body.
export function parseRobots(txt = '') {
  const rules = [];
  let applies = false;
  let inGroup = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, key, value] = m;
    if (/^user-agent$/i.test(key)) {
      if (!inGroup) applies = false;
      inGroup = true;
      if (value.trim() === '*') applies = true;
    } else {
      inGroup = false;
      if (applies && /^disallow$/i.test(key) && value) rules.push(value.trim());
    }
  }
  return rules;
}

export async function robotsAllows(fetchFn, url) {
  const u = new URL(url);
  if (NEVER.test(u.hostname)) return false;
  if (!robotsCache.has(u.origin)) {
    let rules = [];
    try {
      const res = await fetchFn(`${u.origin}/robots.txt`);
      if (res.ok) rules = parseRobots(await res.text());
    } catch { /* no robots.txt reachable: nothing disallowed */ }
    robotsCache.set(u.origin, rules);
  }
  const path = u.pathname + u.search;
  return !robotsCache.get(u.origin).some((r) => path.startsWith(r.replace(/\*.*$/, '')));
}

// Posting text from page HTML: the JSON-LD JobPosting if present (tolerating trailing
// commas, which HigherEdJobs publishes), else the page text.
export function postingTextFromHtml(html = '') {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let d;
    try { d = JSON.parse(m[1]); } catch {
      try { d = JSON.parse(m[1].replace(/,(\s*[}\]])/g, '$1')); } catch { continue; }
    }
    const list = Array.isArray(d) ? d : d['@graph'] || [d];
    const jp = list.find((x) => [].concat(x?.['@type']).includes('JobPosting'));
    if (jp?.description)
      return [jp.description, jp.qualifications, jp.experienceRequirements]
        .filter((x) => typeof x === 'string').map(stripHtml).join('\n');
  }
  const body = html.replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, ' ');
  return stripHtml(body).replace(/\s+/g, ' ').trim();
}

// Wording job sites use for a posting that is gone (HigherEdJobs: "Position Deleted on ...").
const CLOSED_RE = /position deleted on|no longer an active posting|no longer (?:available|accepting applications)|this (?:job|position|posting) (?:has|is) (?:been )?(?:closed|filled|expired|removed)|posting has (?:closed|expired)|job not found/i;
export const isClosedPage = (text = '') => CLOSED_RE.test(text.slice(0, 3000));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Reads up to `limit` postings that have no text yet, in the order given.
// Returns { [id]: { closed, text } }.
// canRead(url) lets the caller veto a host (for example, no extension permission).
export async function readPostings(fetchFn, jobs, { limit = 40, delayMs = 4000, canRead = async () => true, onRead = () => {} } = {}) {
  const out = {};
  let n = 0;
  for (const j of jobs) {
    if (n >= limit) break;
    if (!j.url || (j.description || '').length > 200) continue;
    try {
      if (!(await canRead(j.url)) || !(await robotsAllows(fetchFn, j.url))) continue;
      if (n > 0) await sleep(delayMs);
      n++;
      const res = await fetchFn(j.url, { credentials: 'omit' });
      if (res.status === 404 || res.status === 410) {
        out[j.id] = { closed: true, text: '' };
        await onRead(j.id, out[j.id]);
        continue;
      }
      if (!res.ok) continue;
      const html = await res.text();
      const text = postingTextFromHtml(html).slice(0, 20000);
      if (isClosedPage(postingTextFromHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ' ')))) {
        out[j.id] = { closed: true, text: '' };
        await onRead(j.id, out[j.id]);
        continue;
      }
      if (text.length < 200) continue;
      out[j.id] = { closed: false, text };
      await onRead(j.id, out[j.id]);
    } catch { /* one unreadable posting never stops the rest */ }
  }
  return out;
}
