// Service worker: refreshes listings (from the backend if one is configured,
// otherwise by running the collectors here) and captures the job on the page
// she is viewing when she asks for it.

import { collectAll } from '../../core/collect.js';
import { UNIVERSITY_RE } from '../../core/config.js';
import { normaliseJob } from '../../core/collectors.js';
import { load, save } from './store.js';
import { readPostings } from '../../core/postings.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('refresh', { periodInMinutes: 12 * 60 });
  chrome.contextMenus.create({ id: 'capture', title: 'Save this job to Job Finder', contexts: ['page', 'selection'] });
});
// Choosing the menu item gives the extension access to that one tab.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'capture') capture(tab).catch((e) => save({ captureError: { message: e.message, at: Date.now() } }));
});
chrome.alarms.onAlarm.addListener((a) => a.name === 'refresh' && refresh().catch(console.error));

async function backendFetch(settings, path, init = {}) {
  const res = await fetch(settings.backendUrl.replace(/\/+$/, '') + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(settings.backendToken ? { Authorization: `Bearer ${settings.backendToken}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Backend returned HTTP ${res.status}`);
  return res.json();
}

let refreshing = null;
function refresh({ forceCollect = false } = {}) {
  refreshing ??= (async () => {
    const { settings, jobs: old } = await load('settings', 'jobs');
    let jobs, status;
    if (settings.backendUrl) {
      if (forceCollect) await backendFetch(settings, '/api/collect', { method: 'POST' });
      const data = await backendFetch(settings, '/api/jobs');
      jobs = data.jobs;
      status = { ...(data.status || {}), mode: 'backend', collecting: data.collecting || forceCollect };
    } else {
      const now = new Date().toISOString();
      const firstSeen = new Map(old.map((j) => [j.id, j.firstSeen]));
      const result = await collectAll({
        profile: settings.profile, sources: settings.sources,
        keys: { adzunaAppId: settings.adzunaAppId, adzunaAppKey: settings.adzunaAppKey },
        onProgress: (source) => chrome.runtime.sendMessage({ type: 'progress', source }).catch(() => {}),
      });
      jobs = result.jobs.map((j) => ({ ...j, firstSeen: firstSeen.get(j.id) || now }));
      status = { lastRun: now, report: result.report, mode: 'local' };
    }
    await save({ jobs, status });
    readUnread().catch(console.error); // runs on after the refresh returns
    await updateBadge();
    return status;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

// Reads posting pages that have no text yet (visa sponsorship, requirements), politely.
let reading = null;
function readUnread() {
  reading ??= (async () => {
    const { jobs, captured, details } = await load('jobs', 'captured', 'details');
    const todo = [...jobs.filter((j) => j.category === 'university'), ...jobs.filter((j) => j.category !== 'university'), ...captured]
      .filter((j) => !details[j.id]);
    await readPostings(fetch, todo, {
      limit: 40,
      delayMs: 4000,
      canRead: (url) => chrome.permissions.contains({ origins: [new URL(url).origin + '/*'] }),
      onRead: async (id, { text, closed }) => {
        const cur = (await load('details')).details;
        await save({ details: { ...cur, [id]: { text, closed, at: new Date().toISOString() } } });
      },
    });
  })().finally(() => { reading = null; });
  return reading;
}

async function updateBadge() {
  const { jobs, seenAt, jobState } = await load('jobs', 'seenAt', 'jobState');
  const n = jobs.filter((j) => !jobState[j.id] && (!seenAt || j.firstSeen > seenAt)).length;
  await chrome.action.setBadgeBackgroundColor({ color: '#1f6f54' });
  await chrome.action.setBadgeText({ text: n ? String(Math.min(n, 999)) : '' });
}

// Runs inside the page she is viewing, only after she clicks "Save job from this page".
function extractJobFromPage() {
  const text = (el) => (el?.innerText || '').trim();
  const first = (selectors) => {
    for (const s of selectors) {
      const t = text(document.querySelector(s));
      if (t) return t;
    }
    return '';
  };
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .flatMap((s) => {
      const parse = (t) => {
        try { return JSON.parse(t); } catch { return JSON.parse(t.replace(/,(\s*[}\]])/g, '$1')); }
      };
      try {
        const d = parse(s.textContent);
        return Array.isArray(d) ? d : d['@graph'] || [d];
      } catch { return []; }
    })
    .find((d) => [].concat(d['@type']).includes('JobPosting'));
  const loc = ld?.jobLocation && [].concat(ld.jobLocation)[0]?.address;
  const selection = String(getSelection()).trim();
  return {
    url: location.href,
    title: ld?.title || first([
      '.job-details-jobs-unified-top-card__job-title', '.top-card-layout__title', '.t-24.t-bold', // LinkedIn
      '[data-testid="jobsearch-JobInfoHeader-title"]', '.jobsearch-JobInfoHeader-title', // Indeed
      'h1',
    ]) || document.title,
    company: ld?.hiringOrganization?.name || first([
      '.job-details-jobs-unified-top-card__company-name', '.topcard__org-name-link',
      '[data-testid="inlineHeader-companyName"]', '[data-company-name="true"]',
    ]),
    location: (loc && [loc.addressLocality, loc.addressRegion, loc.addressCountry?.name || loc.addressCountry].filter((x) => typeof x === 'string' && x).join(', ')) || first([
      '.job-details-jobs-unified-top-card__primary-description-container', '.topcard__flavor--bullet',
      '[data-testid="inlineHeader-companyLocation"]', '[data-testid="job-location"]',
    ]),
    description: selection.length > 200 ? selection : ld?.description || first([
      '#job-details', '.jobs-description__content', '.show-more-less-html__markup', // LinkedIn
      '#jobDescriptionText', // Indeed
      '[class*="job-description"]', '[class*="jobDescription"]', '[id*="job-description"]', 'article', 'main',
    ]) || text(document.body).slice(0, 8000),
    postedAt: ld?.datePosted || null,
    host: location.hostname.replace(/^www\./, ''),
  };
}

async function capture(tab) {
  tab ??= (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (!tab?.id) throw new Error('Open a job listing in a browser tab first.');
  let result;
  try {
    [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJobFromPage });
  } catch {
    // Chrome only lets the extension read a tab after she invokes it on that tab.
    throw new Error('Chrome has not given access to this tab yet. Right-click the job page and choose "Save this job to Job Finder".');
  }
  if (!result?.title) throw new Error('Could not find a job on this page. Select the job text and try again.');
  const j = normaliseJob(result.host, result);
  const captured = {
    ...j,
    title: j.title.split('\n')[0].slice(0, 200),
    company: j.company.split('\n')[0],
    location: j.location.split('\n')[0].slice(0, 120),
    category: 'captured',
    university: UNIVERSITY_RE.test(j.company),
    firstSeen: new Date().toISOString(),
    score: null,
  };
  const { captured: list, jobState } = await load('captured', 'jobState');
  await save({
    captured: [captured, ...list.filter((c) => c.id !== captured.id)],
    jobState: { ...jobState, [captured.id]: jobState[captured.id] || 'saved' },
  });
  return captured;
}

const handlers = {
  refresh: (m) => refresh(m),
  readUnread: () => readUnread(),
  capture: () => capture(),
  badge: () => updateBadge(),
  pushConfig: async () => {
    const { settings } = await load('settings');
    if (!settings.backendUrl) return null;
    return backendFetch(settings, '/api/config', {
      method: 'PUT', body: JSON.stringify({ profile: settings.profile, sources: settings.sources }),
    });
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  const h = handlers[msg?.type];
  if (!h) return false;
  h(msg).then((data) => respond({ ok: true, data }), (e) => respond({ ok: false, error: String(e.message || e) }));
  return true;
});
