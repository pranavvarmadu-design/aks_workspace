import { MARKETS, SECTORS } from '../../core/config.js';
import { esc, resumeToHtml, resumeToMarkdown } from '../../core/resume.js';
import { load, save } from './store.js';
import { analyseJob, buildTailoredResume, extractProfile } from './tailor.js';
import { screenJob, visaStatus, relevance, relevanceLevel, isTier1Employer } from '../../core/screen.js';
import { readPostings, robotsAllows } from '../../core/postings.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const send = async (msg) => {
  const r = await chrome.runtime.sendMessage(msg);
  if (!r?.ok) throw new Error(r?.error || 'The extension did not respond. Reload it and try again.');
  return r.data;
};

let state;
const view = { sort: 'relevance',  cat: 'university', filter: 'all', query: '', target: null };

// ---------- tabs ----------

function showTab(name) {
  for (const b of $$('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  for (const s of $$('main > section')) s.hidden = s.id !== `tab-${name}`;
}
for (const b of $$('.tabs button')) b.onclick = () => showTab(b.dataset.tab);

// ---------- jobs ----------

// Listings plus any posting text she has had the extension read (kept across refreshes).
const withText = (j) => {
  const d = state.details?.[j.id];
  if (!d) return j;
  return { ...j, closed: !!d.closed, description: j.description || d.text || '' };
};
const allJobs = () => [...state.captured, ...state.jobs].map(withText);
const stateOf = (j) => state.jobState[j.id];
const isNew = (j) => !stateOf(j) && j.category !== 'captured' && (!state.seenAt || j.firstSeen > state.seenAt);

function jobsFor(cat) {
  if (cat === 'saved') return allJobs().filter((j) => ['saved', 'applied'].includes(stateOf(j)));
  // Closed postings leave the lists; one she saved stays under Saved, marked Closed.
  return state.jobs.map(withText).filter((j) => j.category === cat && stateOf(j) !== 'hidden' && !j.closed);
}

function ago(isoDate) {
  if (!isoDate) return '';
  const d = Math.floor((Date.now() - new Date(isoDate).getTime()) / 864e5);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 31 ? `${d} days ago` : new Date(isoDate).toLocaleDateString();
}

function renderJobs() {
  for (const b of $$('#categories button')) {
    b.setAttribute('aria-pressed', String(b.dataset.cat === view.cat));
    b.querySelector('.count').textContent = `(${jobsFor(b.dataset.cat).length})`;
  }
  const options = view.cat === 'university'
    ? Object.entries(MARKETS).map(([k, m]) => [k, m.label])
    : view.cat === 'industry' ? Object.entries(SECTORS).map(([k, s]) => [k, s.label])
    : [['saved', 'Shortlisted'], ['applied', 'Applied']];
  $('#filters').innerHTML = [['all', 'All'], ...options]
    .map(([k, label]) => `<button data-filter="${k}" aria-pressed="${view.filter === k}">${esc(label)}</button>`).join('');

  const q = view.query.toLowerCase();
  const list = jobsFor(view.cat).filter((j) => {
    if (view.filter !== 'all') {
      const key = view.cat === 'university' ? j.market : view.cat === 'industry' ? j.sector : stateOf(j);
      if (key !== view.filter) return false;
    }
    return !q || `${j.title} ${j.company} ${j.location} ${j.description}`.toLowerCase().includes(q);
  }).map((j) => ({ ...j, rel: relevance(j, state.settings.profile, j.score || 0) }));
  if (view.sort === 'newest') list.sort((a, b) => String(b.postedAt || b.firstSeen).localeCompare(String(a.postedAt || a.firstSeen)));
  else list.sort((a, b) => b.rel - a.rel || String(b.postedAt || b.firstSeen).localeCompare(String(a.postedAt || a.firstSeen)));
  $('#sort').value = view.sort;

  $('#job-list').innerHTML = list.length ? list.slice(0, 200).map(jobCard).join('') : `<div class="empty">${emptyText()}</div>`;
}

function emptyText() {
  if (view.cat === 'saved') return 'Nothing saved yet. Shortlist a listing, or open a job on LinkedIn, Indeed or any careers page and choose "Save job from this page".';
  if (!state.status) return 'No listings yet. Choose "Refresh listings" to run the first search.';
  return 'No listings match. Try another filter, or adjust the search keywords in Settings.';
}

function screenTags(j) {
  const s = screenJob(j, state.settings.profile);
  return [
    ...(s.india ? [
      s.india.sales ? '<span class="tag bad">Sales or marketing role</span>' : '',
      s.india.years != null && s.india.years >= 2 ? `<span class="tag bad">Asks ${s.india.years}+ years experience</span>` : '',
      s.india.industryExperience ? '<span class="tag bad">Wants industry experience</span>' : '',
      s.india.degrees.length ? `<span class="tag bad">Asks for ${esc(s.india.degrees.slice(0, 2).join(' / '))}</span>` : '',
      s.india.phd ? '<span class="tag good">PhD valued</span>' : '',
      s.india.ncr ? '<span class="tag good">Delhi NCR</span>' : '',
    ] : []),
    isTier1Employer(j) ? '<span class="tag good">Oxbridge / Ivy</span>' : '',
    s.blockers.length ? `<span class="tag bad" title="Check whether these are required">Mentions ${esc(s.blockers.slice(0, 3).join(', '))}</span>` : '',
    s.strengths.length ? `<span class="tag good">${esc(s.strengths.slice(0, 3).join(', '))}</span>` : '',
  ];
}

const VISA_TAG = {
  yes: '<span class="tag good">Visa: Yes</span>',
  no: '<span class="tag bad">Visa: No</span>',
  not_mentioned: '<span class="tag warn">Visa: Not mentioned</span>',
  unchecked: '<span class="tag">Visa: not checked</span>',
};
const visaTag = (j) => (j.closed ? '<span class="tag bad">Closed</span>' : VISA_TAG[visaStatus(j)] || '');

function jobCard(j) {
  const st = stateOf(j);
  const tags = [
    isNew(j) ? '<span class="tag new">New</span>' : '',
    st === 'applied' ? '<span class="tag state">Applied</span>' : '',
    j.category === 'university' ? `<span class="tag">${esc(MARKETS[j.market]?.label || j.market || '')}</span>` : '',
    j.category === 'industry' ? `<span class="tag">${esc(SECTORS[j.sector]?.label || '')}</span>` : '',
    `<span class="tag rel-${relevanceLevel(j.rel).toLowerCase()}" title="Relevance ${j.rel}/100">${relevanceLevel(j.rel)} relevance</span>`,
    visaTag(j),
    ...screenTags(j),
    state.tailored[j.id] ? '<span class="tag good">Resume ready</span>' : '',
    `<span class="tag">${esc(j.source)}</span>`,
  ].join('');
  return `<article class="card job" data-id="${esc(j.id)}">
    <h3><a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)}</a></h3>
    <div class="meta">${esc([j.company, j.location, ago(j.postedAt || j.firstSeen)].filter(Boolean).join(' · '))}</div>
    <div class="tags">${tags}</div>
    <div class="actions">
      <button data-act="tailor" class="primary">${state.tailored[j.id] ? 'Open resume' : 'Tailor resume'}</button>
      ${!j.closed && visaStatus(j) === 'unchecked' && j.url ? '<button data-act="read" title="Reads this one posting, as if you opened it">Check visa</button>' : ''}
      ${st === 'saved' || st === 'applied' ? '<button data-act="unsave">Remove</button>' : '<button data-act="saved">Shortlist</button>'}
      ${st === 'applied' ? '' : '<button data-act="applied">Mark applied</button>'}
      ${st || j.category === 'captured' ? '' : '<button data-act="hidden">Hide</button>'}
    </div>
  </article>`;
}

// Reads one posting the user asked about and keeps its text for screening and tailoring.
async function readPosting(j, btn) {
  const origin = new URL(j.url).origin + '/*';
  // Must run before any await so Chrome treats it as part of the click.
  const allowed = chrome.permissions.request({ origins: [origin] }).catch(() => false);
  const label = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Reading...'; }
  try {
    if (!(await allowed)) throw new Error('Chrome was not given access to that site.');
    if (!(await robotsAllows(fetch, j.url))) throw new Error('That site does not allow automated reading. Open the posting and use "Save job from this page".');
    const got = (await readPostings(fetch, [{ ...j, description: '' }], { limit: 1, delayMs: 0 }))[j.id];
    if (!got) throw new Error('Could not read the posting. Open it and use "Save job from this page".');
    if (got.closed) $('#status').textContent = `"${j.title}" is no longer open.`;
    state.details = { ...state.details, [j.id]: { ...got, at: new Date().toISOString() } };
    await save({ details: state.details });
    renderJobs();
  } catch (e) {
    $('#status').textContent = e.message;
    if (btn) { btn.disabled = false; btn.textContent = label; }
    throw e;
  }
}

$('#categories').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  view.cat = b.dataset.cat;
  view.filter = 'all';
  renderJobs();
};
$('#filters').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) { view.filter = b.dataset.filter; renderJobs(); }
};
$('#search').oninput = (e) => { view.query = e.target.value; renderJobs(); };
$('#sort').onchange = (e) => { view.sort = e.target.value; renderJobs(); };

$('#job-list').onclick = async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const id = b.closest('.job').dataset.id;
  const j = allJobs().find((x) => x.id === id);
  const act = b.dataset.act;
  if (act === 'read') return readPosting(j, b);
  if (act === 'tailor') {
    if (!j.description && j.url) await readPosting(j, b).catch(() => {});
    return setTarget(allJobs().find((x) => x.id === id));
  }
  if (act === 'unsave') {
    delete state.jobState[id];
    if (j.category === 'captured') state.captured = state.captured.filter((c) => c.id !== id);
  } else state.jobState[id] = act;
  await save({ jobState: state.jobState, captured: state.captured });
  renderJobs();
};

function renderStatus(progress) {
  const s = state.status;
  const el = $('#status');
  if (progress) return void (el.textContent = `Searching: ${progress}`);
  if (!s) return void (el.textContent = 'Listings come from licensed job APIs, public feeds and university career sites. LinkedIn and Indeed jobs are added only when you save one from its page.');
  const failed = (s.report || []).filter((r) => !r.ok);
  el.textContent = `Updated ${s.lastRun ? new Date(s.lastRun).toLocaleString() : 'never'} ${s.mode === 'backend' ? 'by the backend' : 'in this browser'}` +
    (s.collecting ? ' · a new collection is running, refresh again in a few minutes' : '') +
    (failed.length ? ` · ${failed.length} source${failed.length === 1 ? '' : 's'} failed` : '');
  $('#report').hidden = !(s.report || []).length;
  $('#report-list').innerHTML = (s.report || []).map((r) =>
    `<li class="${r.ok ? '' : 'error'}">${esc(r.source)}: ${r.ok ? `${r.count} listings` : esc(r.error)}</li>`).join('');
}

$('#refresh').onclick = async () => {
  const btn = $('#refresh');
  btn.disabled = true;
  renderStatus('starting');
  try {
    await send({ type: 'refresh', forceCollect: true });
    Object.assign(state, await load('jobs', 'status'));
  } catch (e) {
    $('#status').textContent = e.message;
    btn.disabled = false;
    return;
  }
  btn.disabled = false;
  renderStatus();
  renderJobs();
};

$('#capture').onclick = async () => {
  try {
    await send({ type: 'capture' }); // the storage listener below shows the saved job
  } catch (e) {
    $('#status').textContent = e.message;
  }
};

chrome.runtime.onMessage.addListener((m) => { if (m?.type === 'progress') renderStatus(m.source); });

// Keep the list current when the service worker refreshes or captures in the background.
chrome.storage.onChanged.addListener(async (changes) => {
  if (!state) return;
  if (changes.captureError?.newValue) $('#status').textContent = changes.captureError.newValue.message;
  if (changes.details) {
    state.details = changes.details.newValue || {};
    renderJobs();
  }
  if (changes.jobs || changes.captured || changes.status) {
    Object.assign(state, await load('jobs', 'captured', 'jobState', 'status'));
    if (changes.captured && (changes.captured.newValue?.length || 0) > (changes.captured.oldValue?.length || 0)) {
      view.cat = 'saved';
      view.filter = 'all';
      $('#status').textContent = `Saved "${state.captured[0].title}".`;
    } else if (!$('#refresh').disabled) renderStatus();
    renderJobs();
  }
});

// ---------- resume builder ----------

function setTarget(j) {
  view.target = j;
  $('#target').classList.remove('muted');
  $('#target').innerHTML = `<strong>${esc(j.title)}</strong><br><span class="small muted">${esc([j.company, j.location].filter(Boolean).join(' · '))}</span>` +
    (j.description ? '' : '<br><span class="small error">This listing has no description. Open it, then use "Save job from this page" for a better result.</span>');
  $('#build').disabled = false;
  $('#build-msg').textContent = '';
  $('#screen-stop').hidden = true;
  view.pendingAnalysis = null;
  $('#master').open = !state.resume;
  showResult(state.tailored[j.id]);
  showTab('resume');
}

const VERDICT = { apply: 'Worth applying', borderline: 'Borderline', skip: 'Advised: skip' };
const SPONSOR = { offered: 'Visa sponsorship offered', not_offered: 'No visa sponsorship', not_stated: 'Sponsorship not stated: check before applying', not_applicable: '' };
function screenHtml(sc) {
  if (!sc) return '';
  const lacks = sc.requiredSheLacks?.length ? `<br>Required and not in your skills: ${esc(sc.requiredSheLacks.join(', '))}` : '';
  const sp = SPONSOR[sc.sponsorship] ? `<br>${esc(SPONSOR[sc.sponsorship])}` : '';
  return `<div class="verdict ${esc(sc.verdict)}"><strong>${esc(VERDICT[sc.verdict] || sc.verdict)}.</strong> ${esc(sc.reason)}${sp}${lacks}</div>`;
}

function showResult(t) {
  $('#result').hidden = !t;
  if (!t) return;
  const r = t.review;
  const list = (title, items) => items?.length ? `<strong>${title}</strong><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  $('#review').innerHTML =
    screenHtml(t.analysis.screen) +
    `<h3>Fit for this role: ${Number(r.matchScore) || 0}/100</h3>` +
    (r.unsupportedClaims?.length
      ? `<div class="warn"><strong>Check before sending.</strong> The reviewer could not find these in your master resume:<ul>${r.unsupportedClaims.map((c) => `<li>${esc(c.claim)} <span class="small">(${esc(c.reason)})</span></li>`).join('')}</ul></div>`
      : '<p class="small">Every claim was found in your master resume.</p>') +
    list('Requirements not shown in your resume', r.gaps) +
    list('Add these to your master resume if they apply', r.suggestions) +
    (t.analysis.applicationNotes ? `<strong>The listing also asks for</strong><p class="small">${esc(t.analysis.applicationNotes)}</p>` : '');
  $('#preview').innerHTML = resumeToHtml(t.resume, { standalone: false });
  const L = t.letter;
  $('#letter-wrap').hidden = !L;
  $('#letter').value = L ? [L.salutation, ...(L.paragraphs || []), L.closing, L.signature].filter(Boolean).join('\n\n') : '';
}

async function runBuild(force) {
  const j = view.target;
  const btn = $('#build');
  btn.disabled = true;
  $('#build-msg').textContent = '';
  $('#screen-stop').hidden = true;
  $('#steps').hidden = false;
  const order = ['analyst', 'tailor', 'letter', 'reviewer'];
  const mark = (step) => {
    for (const li of $$('#steps li')) {
      const i = order.indexOf(li.dataset.step), cur = order.indexOf(step);
      li.className = i < cur ? 'done' : i === cur ? 'active' : '';
    }
  };
  const opts = { notes: $('#notes').value.trim(), candidate: state.candidate };
  try {
    if (!state.resume.trim()) throw new Error('Paste your resume in the Resume builder tab first.');
    mark('analyst');
    opts.analysis = (force && view.pendingAnalysis) || await analyseJob(state.settings, j, state.candidate);
    const sc = opts.analysis.screen;
    if (!force && sc && sc.verdict === 'skip') {
      view.pendingAnalysis = opts.analysis;
      $('#screen-stop').innerHTML = `<h3>Probably not worth applying</h3>${screenHtml(sc)}<p class="small muted">Nothing has been tailored yet. You can still build it.</p><button id="build-anyway">Build anyway</button>`;
      $('#screen-stop').hidden = false;
      $('#build-anyway').onclick = () => runBuild(true);
      return;
    }
    const t = await buildTailoredResume(state.settings, state.resume, j, opts, mark);
    view.pendingAnalysis = null;
    state.tailored[j.id] = t;
    await save({ tailored: state.tailored });
    mark('finished');
    showResult(t);
    renderJobs();
  } catch (e) {
    $('#build-msg').textContent = e.message;
  } finally {
    $('#steps').hidden = true;
    btn.disabled = false;
  }
}
$('#build').onclick = () => runBuild(false);

const currentResume = () => state.tailored[view.target?.id]?.resume;
const fileName = (ext) => `${currentResume().name} - ${view.target.company || view.target.title}`.replace(/[^\w .-]+/g, '').slice(0, 80) + ext;
const download = (blob, name) => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};

$('#print').onclick = async () => {
  // print.html (an extension page) renders the saved resume and opens the print dialog.
  await save({ printDoc: currentResume() });
  chrome.tabs.create({ url: chrome.runtime.getURL('print.html') });
};
$('#download-doc').onclick = () =>
  download(new Blob(['﻿', resumeToHtml(currentResume())], { type: 'application/msword' }), fileName('.doc'));
$('#copy-md').onclick = async (e) => {
  await navigator.clipboard.writeText(resumeToMarkdown(currentResume()));
  e.target.textContent = 'Copied';
  setTimeout(() => (e.target.textContent = 'Copy as Markdown'), 1500);
};

$('#save-resume').onclick = async () => {
  state.resume = $('#resume-text').value;
  state.candidate = $('#candidate-text').value;
  await save({ resume: state.resume, candidate: state.candidate });
  $('#resume-msg').textContent = 'Resume and skills notes saved in this browser.';
};

$('#extract-profile').onclick = async (e) => {
  e.target.disabled = true;
  $('#resume-msg').textContent = 'Reading the resume...';
  try {
    state.resume = $('#resume-text').value;
    await save({ resume: state.resume });
    if (!state.resume.trim()) throw new Error('Paste the resume first.');
    const p = await extractProfile(state.settings, state.resume + (state.candidate ? `\n\nSkills and constraints:\n${state.candidate}` : ''));
    state.settings.profile = { ...state.settings.profile, ...p };
    await save({ settings: state.settings });
    await send({ type: 'pushConfig' }).catch(() => {});
    fillSettings();
    $('#resume-msg').textContent = `Search keywords updated: ${p.fieldKeywords.join(', ')}. Review them in Settings, then refresh the listings.`;
  } catch (err) {
    $('#resume-msg').textContent = err.message;
  }
  e.target.disabled = false;
};

// ---------- settings ----------

const SIMPLE = ['anthropicKey', 'model', 'adzunaAppId', 'adzunaAppKey', 'backendUrl', 'backendToken'];

function fillSettings() {
  const s = state.settings;
  for (const k of SIMPLE) $(`#s-${k}`).value = s[k] || '';
  for (const k of ['fieldKeywords', 'academicRoles', 'excludeTerms']) $(`#s-${k}`).value = (s.profile[k] || []).join('\n');
  for (const k of Object.keys(SECTORS)) $(`#s-${k}`).value = (s.profile.sectorQueries?.[k] || []).join('\n');
  $('#s-sources').value = JSON.stringify(s.sources, null, 2);
}

$('#save-settings').onclick = async () => {
  const msg = $('#settings-msg');
  let sources;
  try {
    sources = JSON.parse($('#s-sources').value);
  } catch (e) {
    return void (msg.textContent = `The sources JSON is not valid: ${e.message}`);
  }
  const s = state.settings;
  for (const k of SIMPLE) s[k] = $(`#s-${k}`).value.trim();
  for (const k of ['fieldKeywords', 'academicRoles', 'excludeTerms']) s.profile[k] = lines($(`#s-${k}`).value);
  s.profile.sectorQueries = Object.fromEntries(Object.keys(SECTORS).map((k) => [k, lines($(`#s-${k}`).value)]));
  s.sources = sources;

  // Ask Chrome for access to any extra hosts these settings need (custom feeds, a remote backend).
  const origins = [s.backendUrl, ...(sources.rss || []).map((f) => f.url)]
    .filter(Boolean)
    .map((u) => { try { return new URL(u).origin + '/*'; } catch { return null; } })
    .filter((o) => o && o.startsWith('https://'));
  if (origins.length && !(await chrome.permissions.contains({ origins })))
    if (!(await chrome.permissions.request({ origins }).catch(() => false)))
      return void (msg.textContent = 'Not saved: Chrome was not given access to those sites.');

  await save({ settings: s });
  const pushed = await send({ type: 'pushConfig' }).then((r) => !!r, () => false);
  msg.textContent = s.backendUrl
    ? pushed ? 'Saved, and the backend now uses these search settings.' : 'Saved here, but the backend could not be reached.'
    : 'Saved.';
};

// ---------- start ----------

(async function init() {
  state = await load();
  $('#resume-text').value = state.resume;
  $('#candidate-text').value = state.candidate;
  fillSettings();
  renderStatus();
  renderJobs();
  // "New" is judged against the last time the panel was opened.
  save({ seenAt: new Date().toISOString() }).then(() => send({ type: 'badge' })).catch(() => {});
  if (!state.status) showTab(state.resume ? 'jobs' : 'resume');
})();

// Keep the master resume and skills notes saved as she edits them.
for (const [id, key] of [['#resume-text', 'resume'], ['#candidate-text', 'candidate']])
  $(id).addEventListener('input', () => {
    state[key] = $(id).value;
    clearTimeout($(id)._t);
    $(id)._t = setTimeout(() => save({ [key]: state[key] }), 400);
  });
