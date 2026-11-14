// Hosted version of the job finder: a Claude artifact page.
// Listings live in the page's shared database (Claude collects them);
// the resume and saved jobs live in the viewer's private space.
import { MARKETS, SECTORS, DEFAULT_PROFILE } from '../core/config.js';
import { scoreJob, finalise } from '../core/collect.js';
import { screenJob, visaStatus, relevance, relevanceLevel, isTopPriority, isBiotechGenetics } from '../core/screen.js';
import { parseIndeedList, parseIndeedDetail, indeedSearches, indeedToRaw, resultText } from '../core/indeed.js';
import { AGENTS } from '../core/prompts.js';
import { esc, resumeToHtml, resumeToMarkdown } from '../core/resume.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const view = { sort: 'relevance', cat: 'university', filter: 'all', query: '', target: null };
const state = { candidate: '', stageLog: {}, jobNotes: {}, labTexts: {}, jobs: [], captured: [], jobState: {}, tailored: {}, descriptions: {}, resume: '', profile: DEFAULT_PROFILE, status: null };
let db, mine, sample, downloads, mcp;

const notice = (msg) => { $('#notice').hidden = !msg; $('#notice').textContent = msg || ''; };

// "Applications" is the Jobs tab showing only the pipeline (the saved jobs and their stages).
function showTab(name) {
  const apps = name === 'apps';
  if (name === 'jobs' || apps) {
    const cat = apps ? 'saved' : view.cat === 'saved' ? 'university' : view.cat;
    if (cat !== view.cat) { view.cat = cat; view.filter = 'all'; }
    renderJobs();
  }
  for (const b of $$('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  for (const s of $$('main > section')) s.hidden = s.id !== `tab-${apps ? 'jobs' : name}`;
  // In Applications, the job-source controls are out of the way.
  $('#categories').hidden = apps;
  $('#apps-intro').hidden = !apps;
  scrollTo(0, 0);
}
for (const b of $$('.tabs button')) b.onclick = () => showTab(b.dataset.tab);

// ---------- jobs ----------

const withText = (j) => (state.descriptions[j.id] ? { ...j, description: state.descriptions[j.id] } : j);
const allJobs = () => [...state.captured, ...state.jobs].map(withText);
const stateOf = (j) => state.jobState[j.id];
// The application pipeline: each saved job sits in one stage; stageLog keeps the date it moved.
const STAGES = [['saved', 'Shortlisted'], ['applied', 'Applied'], ['interview', 'Interview'], ['offer', 'Offer'], ['rejected', 'Not successful']];
const STAGE_KEYS = STAGES.map(([k]) => k);
const saveState = () => put('state', { map: state.jobState, log: state.stageLog, notes: state.jobNotes });
function setStage(id, stage) {
  if (stage) state.jobState[id] = stage; else delete state.jobState[id];
  if (stage) state.stageLog[id] = { ...state.stageLog[id], [stage]: new Date().toISOString() };
  saveState();
}
const jobsFor = (cat) => cat === 'saved'
  ? allJobs().filter((j) => STAGE_KEYS.includes(stateOf(j)))
  : state.jobs.map(withText).filter((j) => j.category === cat && stateOf(j) !== 'hidden');

function ago(d) {
  if (!d) return '';
  const n = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n < 31 ? `${n} days ago` : new Date(d).toLocaleDateString();
}

function renderJobs() {
  for (const b of $$('#categories button')) {
    b.setAttribute('aria-pressed', String(b.dataset.cat === view.cat));
    b.querySelector('.count').textContent = `(${jobsFor(b.dataset.cat).length})`;
  }
  const options = view.cat === 'university' ? Object.entries(MARKETS).map(([k, m]) => [k, m.label])
    : view.cat === 'industry' ? Object.entries(SECTORS).map(([k, s]) => [k, s.label])
    : STAGES;
  $('#filters').innerHTML = [['all', 'All'], ...options]
    .map(([k, l]) => `<button data-filter="${k}" aria-pressed="${view.filter === k}">${esc(l)}</button>`).join('');
  const q = view.query.toLowerCase();
  const list = jobsFor(view.cat).filter((j) => {
    if (view.filter !== 'all') {
      const key = view.cat === 'university' ? j.market : view.cat === 'industry' ? j.sector : stateOf(j);
      if (key !== view.filter) return false;
    }
    return !q || `${j.title} ${j.company} ${j.location} ${j.description || ''} ${j.feed || ''}`.toLowerCase().includes(q);
  }).map((j) => ({ ...j, rel: relevance(j, state.profile, j.score || 0) }));
  const newest = (a, b) => String(b.postedAt || b.firstSeen).localeCompare(String(a.postedAt || a.firstSeen));
  list.sort(view.sort === 'newest' ? newest : (a, b) => b.rel - a.rel || newest(a, b));
  $('#sort').value = view.sort;
  renderPipeline();
  $('#tabbtn-apps').textContent = `Applications (${jobsFor('saved').length})`;
  // Each segment has its own Indeed search; Saved has none.
  $('#indeed-bar').hidden = view.cat !== 'industry';
  $('#indeed-run').textContent = 'Search Indeed: India industry';
  $('#job-list').innerHTML = list.length ? list.slice(0, 200).map(jobCard).join('') : `<div class="empty">${emptyText()}</div>`;
}

function renderPipeline() {
  const el = $('#pipeline');
  el.hidden = view.cat !== 'saved';
  if (el.hidden) return;
  const mine = jobsFor('saved');
  el.innerHTML = STAGES.map(([k, label]) =>
    `<button data-filter="${k}" aria-pressed="${view.filter === k}"><strong>${mine.filter((j) => stateOf(j) === k).length}</strong>${esc(label)}</button>`).join('');
}
$('#pipeline').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) { view.filter = view.filter === b.dataset.filter ? 'all' : b.dataset.filter; renderJobs(); }
};

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
function stageRow(j) {
  const st = stateOf(j);
  const log = state.stageLog[j.id] || {};
  const when = log[st] ? `since ${fmtDate(log[st])}` : '';
  const applied = log.applied ? `applied ${fmtDate(log.applied)}` : '';
  const waiting = st === 'applied' && log.applied && (Date.now() - new Date(log.applied)) / 864e5 > 14;
  return `<div class="stage-row">
    <select data-act="stage" aria-label="Application stage">${STAGES.map(([k, l]) => `<option value="${k}" ${k === st ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    <span>${esc([when, st !== 'applied' ? applied : ''].filter(Boolean).join(' · '))}</span>
    ${waiting ? '<span class="tag warn">No reply after 2 weeks: follow up?</span>' : ''}
  </div>
  <details${state.jobNotes[j.id] ? ' open' : ''}><summary>Notes</summary><textarea data-act="note" rows="2" placeholder="Contact, follow-up dates, interview notes">${esc(state.jobNotes[j.id] || '')}</textarea></details>`;
}

function emptyText() {
  if (view.cat === 'saved') return 'No applications yet. In Jobs, choose "Shortlist" or "Mark applied" on a listing, or paste a job you found elsewhere below. Each one then appears here with a stage you can change.';
  if (view.cat === 'industry' || view.filter === 'SG' || view.filter === 'EMEA')
    return 'No listings collected for this group yet. Claude adds them when it next collects listings.';
  return 'No listings match this filter.';
}

const VISA_TAG = {
  yes: '<span class="tag good">Visa: Yes</span>',
  no: '<span class="tag bad">Visa: No</span>',
  not_mentioned: '<span class="tag warn">Visa: Not mentioned</span>',
  unchecked: '<span class="tag">Visa: not checked</span>',
};

function screenTags(j) {
  const s = screenJob(j, state.profile);
  return [
    ...(s.india ? [
      s.india.sales ? '<span class="tag bad">Sales or marketing role</span>' : '',
      s.india.years != null && s.india.years >= 2 ? `<span class="tag bad">Asks ${s.india.years}+ years experience</span>` : '',
      s.india.industryExperience ? '<span class="tag bad">Wants industry experience</span>' : '',
      s.india.degrees.length ? `<span class="tag bad">Asks for ${esc(s.india.degrees.slice(0, 2).join(' / '))}</span>` : '',
      s.india.phd ? '<span class="tag good">PhD valued</span>' : '',
      s.india.ncr ? '<span class="tag good">Delhi NCR</span>' : '',
    ] : []),
    s.core.length ? `<span class="tag rel-high" title="Her core skills named in this listing">Core skills: ${esc(s.core.slice(0, 3).map((c) => c.name).join(', '))}${s.core.length > 3 ? ` +${s.core.length - 3}` : ''}</span>` : '',
    isTopPriority(j) ? '<span class="tag good">Top priority</span>' : '',
    isBiotechGenetics(j) ? '<span class="tag warn" title="Biotechnology or genetics: outside her skills, lower priority">Biotech / genetics</span>' : '',
    s.blockers.length ? `<span class="tag bad">Mentions ${esc(s.blockers.slice(0, 3).join(', '))}</span>` : '',
    s.strengths.length ? `<span class="tag good">${esc(s.strengths.slice(0, 3).join(', '))}</span>` : '',
  ];
}

function jobCard(j) {
  const st = stateOf(j);
  const tags = [
    st && st !== 'saved' && view.cat !== 'saved' ? `<span class="tag state">${esc(STAGES.find(([k]) => k === st)?.[1] || st)}</span>` : '',
    j.category === 'university' ? `<span class="tag">${esc(MARKETS[j.market]?.label || j.market || '')}</span>` : '',
    j.category === 'industry' ? `<span class="tag">${esc(SECTORS[j.sector]?.label || '')}</span>` : '',
    j.feed ? `<span class="tag">${esc(j.feed)}</span>` : '',
    `<span class="tag rel-${relevanceLevel(j.rel ?? 0).toLowerCase()}" title="Relevance ${j.rel ?? 0}/100">${relevanceLevel(j.rel ?? 0)} relevance</span>`,
    VISA_TAG[visaStatus(j)] || '',
    ...screenTags(j),
    j.salary ? `<span class="tag">${esc(j.salary)}</span>` : '',
    state.tailored[j.id] ? '<span class="tag good">Resume ready</span>' : '',
    `<span class="tag">${esc(j.source || 'added by you')}</span>`,
  ].join('');
  const title = j.url ? `<a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)}</a>` : esc(j.title);
  return `<article class="card job" data-id="${esc(j.id)}">
    <h3>${title}</h3>
    <div class="meta">${esc([j.company, j.location, ago(j.postedAt || j.firstSeen)].filter(Boolean).join(' · '))}</div>
    <div class="tags">${tags}</div>
    ${view.cat === 'saved' ? stageRow(j) : ''}
    <div class="actions">
      <button data-act="tailor" class="primary">${state.tailored[j.id] ? 'Open application' : 'Tailor application'}</button>
      ${st ? '<button data-act="unsave">Remove</button>' : '<button data-act="saved">Shortlist</button>'}
      ${st && st !== 'saved' ? '' : '<button data-act="applied">Mark applied</button>'}
      ${st || j.category === 'captured' ? '' : '<button data-act="hidden">Hide</button>'}
    </div>
  </article>`;
}

$('#categories').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.cat === 'saved') return showTab('apps');
  view.cat = b.dataset.cat; view.filter = 'all'; renderJobs();
};
$('#filters').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) { view.filter = b.dataset.filter; renderJobs(); }
};
$('#search').oninput = (e) => { view.query = e.target.value; renderJobs(); };
$('#sort').onchange = (e) => { view.sort = e.target.value; renderJobs(); };

// ---------- Indeed, through the viewer's own Indeed connector ----------

const INDEED_STOP = {
  server_not_connected: 'Connect Indeed in claude.ai Settings → Connectors, then try again.',
  needs_reauth: 'Your Indeed connection has expired. Reconnect Indeed in claude.ai Settings → Connectors.',
  selection_required: 'Choose which Indeed connection to use in the prompt claude.ai shows, then try again.',
  not_in_manifest: 'Indeed is turned off for this page. Allow it in the page permissions, then try again.',
  approval_required: 'This search needs your approval. Click "Search Indeed" again and allow it when claude.ai asks.',
  blocked_by_policy: 'Your organisation does not allow Indeed here.',
};
const indeedMsg = (t) => { $('#indeed-msg').textContent = t; };

async function runIndeed(kind) {
  const btn = $('#indeed-run');
  if (!mcp) return indeedMsg('Indeed is available when this page is open on claude.ai with Indeed connected.');
  btn.disabled = true;
  const raw = [];
  let stop = null;
  const searches = indeedSearches(state.profile, kind);
  try {
    for (const [i, s] of searches.entries()) {
      indeedMsg(`Searching Indeed (${i + 1} of ${searches.length}): ${s.search}, ${s.location}`);
      if (i) await new Promise((r) => setTimeout(r, 400)); // a gentle pace on her connection
      try {
        const r = await mcp.callTool('Indeed', 'search_jobs', { search: s.search, location: s.location, country_code: s.country });
        raw.push(...parseIndeedList(resultText(r)).map((j) => indeedToRaw(j, s)));
      } catch (e) {
        if (INDEED_STOP[e?.code]) { stop = INDEED_STOP[e.code]; break; }
        // one failed search does not stop the rest
      }
    }
    // Same filters as every other source; then read the full posting for the most relevant.
    const found = finalise(raw, state.profile).map((j) => ({ ...j, firstSeen: new Date().toISOString() }));
    const ranked = found.map((j) => ({ j, r: relevance(j, state.profile, j.score) })).sort((a, b) => b.r - a.r).map((x) => x.j);
    let n = 0;
    for (const j of ranked) {
      if (stop || n >= 12) break;
      indeedMsg(`Reading postings for visa and requirements (${n + 1} of ${Math.min(12, ranked.length)})`);
      n++;
      try {
        j.description = parseIndeedDetail(resultText(await mcp.callTool('Indeed', 'get_job_details', { job_id: j.jobId }))).slice(0, 20000);
      } catch (e) {
        if (INDEED_STOP[e?.code]) stop = INDEED_STOP[e.code];
      }
    }
    for (const j of found) {
      const { jobId, ...keep } = j;
      const i = state.jobs.findIndex((x) => x.id === j.id);
      if (i >= 0) state.jobs[i] = { ...state.jobs[i], ...keep, description: keep.description || state.jobs[i].description };
      else state.jobs.push(keep);
      put(`i_${j.id.replace(/[^A-Za-z0-9_-]/g, '_')}`, keep);
    }
    rescore();
    renderJobs();
    const where = kind === 'industry' ? 'India industry' : 'postdoc';
    indeedMsg(stop || `Indeed: ${found.length} ${where} listings matched her profile (from ${raw.length} results across ${new Set(searches.map((s) => s.country)).size} ${kind === 'industry' ? 'country' : 'countries'}).`);
  } finally {
    btn.disabled = false;
  }
}
$('#indeed-run').onclick = () => runIndeed('industry');

$('#job-list').onclick = async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const id = b.closest('.job').dataset.id;
  const j = allJobs().find((x) => x.id === id);
  const act = b.dataset.act;
  if (act === 'tailor') return setTarget(j);
  if (act === 'unsave') {
    setStage(id, null);
    if (j.category === 'captured') {
      state.captured = state.captured.filter((c) => c.id !== id);
      put(`c_${id}`, null);
    }
  } else if (act === 'hidden') {
    state.jobState[id] = 'hidden';
    saveState();
  } else setStage(id, act);
  renderJobs();
};
$('#job-list').onchange = (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const id = el.closest('.job').dataset.id;
  if (el.dataset.act === 'stage') { setStage(id, el.value); renderJobs(); }
  if (el.dataset.act === 'note') { state.jobNotes[id] = el.value; saveState(); }
};

function rescore() {
  state.jobs = state.jobs.map((j) => ({ ...j, score: scoreJob({ title: j.title, feed: j.feed, description: j.description || '' }, state.profile) }))
    .sort((a, b) => b.score - a.score || String(b.postedAt).localeCompare(String(a.postedAt)));
}

function renderStatus() {
  const s = state.status;
  $('#status').textContent = s?.lastRun
    ? `Listings last collected ${new Date(s.lastRun).toLocaleString()}. ${s.note || ''}`
    : 'No listings have been collected yet.';
}

function renderProfile() {
  const p = state.profile;
  $('#profile-view').innerHTML = [
    ['Fields', p.fieldKeywords], ['University roles', p.academicRoles],
    ...Object.entries(SECTORS).map(([k, s]) => [`India ${s.label}`, p.sectorQueries?.[k]]),
    ['Skills', p.skills],
  ].filter(([, v]) => v?.length).map(([k, v]) => `<div><strong>${esc(k)}:</strong> ${esc(v.join(', '))}</div>`).join('') || 'Not set yet.';
}

// ---------- private storage ----------

// Writes one document in the viewer's private space; null deletes it.
async function put(id, data) {
  if (!mine) return notice('Sign in to Claude to save your changes.');
  try {
    if (data === null) await mine.doc(id).delete();
    else await mine.doc(id).set(data);
  } catch (e) {
    notice(`Could not save (${e.code || e.message}). Your change is kept until you close this page.`);
  }
}

// ---------- add a job by pasting ----------

$('#add-job').onclick = async () => {
  const text = $('#add-text').value.trim();
  const msg = $('#add-msg');
  if (text.length < 40) return void (msg.textContent = 'Paste the posting text first.');
  const btn = $('#add-job');
  btn.disabled = true;
  msg.textContent = 'Reading the posting...';
  let head = { title: text.split('\n')[0].slice(0, 120), company: '', location: '' };
  try {
    if (sample) head = await sample.json(
      'From this job posting, reply with only a JSON object {"title": string, "company": string, "location": string}. Use an empty string for anything not stated.\n\n<posting>\n' + text.slice(0, 6000) + '\n</posting>',
      { modelTier: 'quick' });
  } catch { /* keep the first-line fallback */ }
  const id = 'c' + Date.now().toString(36);
  const j = { id, category: 'captured', source: 'added by you', title: String(head.title || 'Untitled job').slice(0, 200), company: String(head.company || ''), location: String(head.location || ''), url: /^https?:\/\//.test($('#add-url').value.trim()) ? $('#add-url').value.trim() : '', description: text.slice(0, 20000), firstSeen: new Date().toISOString() };
  state.captured.unshift(j);
  await put(`c_${id}`, j);
  setStage(id, 'saved');
  $('#add-text').value = $('#add-url').value = '';
  msg.textContent = `Added "${j.title}".`;
  btn.disabled = false;
  view.cat = 'saved';
  view.filter = 'all';
  renderJobs();
};

// ---------- resume builder ----------

const ask = (agent, userText, tier) => {
  if (!sample) throw new Error('Claude is not available in this view. Open the page on claude.ai while signed in.');
  return sample.json(
    `${agent.system}\n\n${userText}\n\nReply with only one JSON object that matches this JSON Schema, with no text before or after it:\n${JSON.stringify(agent.schema)}`,
    { modelTier: tier, cache: false });
};

const sampleError = (e) => ({
  not_granted: 'Claude was not allowed to run for this page. Allow it in the page permissions and try again.',
  rate_limited: 'Too many requests. Wait a minute and try again.',
  prompt_too_large: 'The resume and job text together are too long. Shorten the job description.',
  refused: 'Claude declined this request.',
  invalid_json: 'Claude returned an answer that could not be read. Try again.',
}[e?.code] || e?.message || 'Something went wrong. Try again.');

function setTarget(j) {
  view.target = j;
  $('#target').classList.remove('muted');
  $('#target').innerHTML = `<strong>${esc(j.title)}</strong><br><span class="small muted">${esc([j.company, j.location].filter(Boolean).join(' · '))}</span>` +
    (j.url ? `<br><a class="small" href="${esc(j.url)}" target="_blank" rel="noopener">Open the posting</a>` : '');
  $('#builder-form').hidden = false;
  $('#job-desc').value = state.descriptions[j.id] ?? j.description ?? '';
  $('#lab-text').value = state.labTexts[j.id] || '';
  $('#build-msg').textContent = state.resume.trim() ? '' : 'Add your resume in the My resume tab first.';
  $('#screen-stop').hidden = true;
  view.pendingAnalysis = null;
  showResult(state.tailored[j.id]);
  showTab('builder');
}

const letterToText = (L) => [L.salutation, ...(L.paragraphs || []), L.closing, L.signature].filter(Boolean).join('\n\n');

function showResult(t) {
  $('#result').hidden = !t;
  if (!t) return;
  const r = t.review;
  const list = (title, items) => items?.length ? `<strong>${title}</strong><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  $('#review').innerHTML = screenHtml(t.analysis.screen) + `<h3>Fit for this role: ${Number(r.matchScore) || 0}/100</h3>` +
    (r.unsupportedClaims?.length
      ? `<div class="warn"><strong>Check before sending.</strong> The reviewer could not find these in your master resume or notes:<ul>${r.unsupportedClaims.map((c) => `<li>${esc(c.claim)} <span class="small">(${esc(c.reason)})</span></li>`).join('')}</ul></div>`
      : '<p class="small">Every claim in the resume and letter was found in your master resume.</p>') +
    list('Requirements not shown in your resume', r.gaps) +
    list('Add these to your master resume if they apply', r.suggestions) +
    (t.analysis.applicationNotes ? `<strong>The listing also asks for</strong><p class="small">${esc(t.analysis.applicationNotes)}</p>` : '');
  const a = t.analysis;
  const lab = a.labResearch || {};
  $('#lab-fit').hidden = !(lab.focus || a.fitToLab?.length);
  $('#lab-fit').innerHTML = `<h3>${esc(a.contact?.name ? `${a.contact.name}${a.contact.title ? `, ${a.contact.title}` : ''}` : 'The lab')}</h3>` +
    (lab.focus ? `<p class="small">${esc(lab.focus)}</p>` : '') +
    list('Research themes', lab.themes) + list('Methods the lab relies on', lab.methods) +
    (a.fitToLab?.length ? `<strong>Where she fits</strong><ul>${a.fitToLab.map((f) => `<li>${esc(f.labNeed)}: <span class="small">${esc(f.herEvidence)}</span></li>`).join('')}</ul>` : '');
  $('#preview').innerHTML = resumeToHtml(t.resume, { standalone: false });
  $('#letter').value = t.letterText || (t.letter ? letterToText(t.letter) : '');
  $('#email-subject').value = t.email?.subject || '';
  $('#email-body').value = t.email?.body || '';
  $('#mark-applied').textContent = stateOf(view.target) === 'applied' ? 'Applied ✓' : 'Mark as applied';
  $('#package-msg').textContent = '';
}

const VERDICT = { apply: 'Worth applying', borderline: 'Borderline', skip: 'Advised: skip' };
const SPONSOR = { offered: 'Visa sponsorship offered', not_offered: 'No visa sponsorship', not_stated: 'Sponsorship not stated: check before applying', not_applicable: '' };
function screenHtml(sc) {
  if (!sc) return '';
  const lacks = sc.requiredSheLacks?.length ? `<br>Required and not in your skills: ${esc(sc.requiredSheLacks.join(', '))}` : '';
  const sp = SPONSOR[sc.sponsorship] ? `<br>${esc(SPONSOR[sc.sponsorship])}` : '';
  return `<div class="verdict ${esc(sc.verdict)}"><strong>${esc(VERDICT[sc.verdict] || sc.verdict)}.</strong> ${esc(sc.reason)}${sp}${lacks}</div>`;
}

async function runBuild(force) {
  const j = view.target;
  const msg = $('#build-msg');
  if (!state.resume.trim()) return void (msg.textContent = 'Add your resume in the My resume tab first.');
  const description = $('#job-desc').value.trim();
  if (description !== (j.description || '')) {
    state.descriptions[j.id] = description;
    put(`d_${j.id}`, { text: description });
  }
  const job = { ...j, description };
  const labText = $('#lab-text').value.trim();
  if (labText !== (state.labTexts[j.id] || '')) {
    state.labTexts[j.id] = labText;
    put(`l_${j.id}`, { text: labText });
  }
  const btn = $('#build');
  btn.disabled = true;
  msg.textContent = '';
  $('#screen-stop').hidden = true;
  $('#steps').hidden = false;
  const order = ['analyst', 'tailor', 'letter', 'reviewer'];
  const mark = (step) => {
    for (const li of $$('#steps li')) {
      const i = order.indexOf(li.dataset.step), cur = order.indexOf(step);
      li.className = i < cur ? 'done' : i === cur ? 'active' : '';
    }
  };
  try {
    const opts = { notes: $('#notes').value.trim(), candidate: state.candidate };
    mark('analyst');
    const analysis = (force && view.pendingAnalysis) || await ask(AGENTS.analyst, AGENTS.analyst.user(job, state.candidate, labText), 'default');
    // The playbook's 30-second screen: stop before tailoring when she would be ruled out.
    if (!force && analysis.screen?.verdict === 'skip') {
      view.pendingAnalysis = analysis;
      $('#screen-stop').innerHTML = `<h3>Probably not worth applying</h3>${screenHtml(analysis.screen)}<p class="small muted">Nothing has been tailored yet. You can still build it.</p><button id="build-anyway">Build anyway</button>`;
      $('#screen-stop').hidden = false;
      $('#build-anyway').onclick = () => runBuild(true);
      return;
    }
    mark('tailor');
    const resume = await ask(AGENTS.tailor, AGENTS.tailor.user(state.resume, job, analysis, opts), 'complex');
    mark('letter');
    const letter = await ask(AGENTS.letter, AGENTS.letter.user(state.resume, job, analysis, resume, state.candidate, opts.notes), 'complex');
    mark('reviewer');
    const review = await ask(AGENTS.reviewer, AGENTS.reviewer.user(state.resume, resume, analysis, state.candidate, letter), 'default');
    const t = { analysis, resume, letter, letterText: letterToText(letter), email: { subject: letter.emailSubject, body: letter.emailBody }, review, builtAt: new Date().toISOString() };
    view.pendingAnalysis = null;
    state.tailored[j.id] = t;
    put(`t_${j.id}`, t);
    showResult(t);
    renderJobs();
  } catch (e) {
    msg.textContent = sampleError(e);
  } finally {
    $('#steps').hidden = true;
    btn.disabled = false;
  }
}
$('#build').onclick = () => runBuild(false);

const current = () => state.tailored[view.target?.id]?.resume;
const fileName = (ext) => `${current().name} - ${view.target.company || view.target.title}`.replace(/[^\w .-]+/g, '').trim().slice(0, 80) + ext;

async function offer(filename, data, btn) {
  const label = btn.textContent;
  try {
    if (!downloads) throw { code: 'unavailable' };
    await downloads.save({ filename, data });
  } catch (e) {
    if (e?.code !== 'declined') {
      btn.textContent = 'Downloads are not available here';
      setTimeout(() => (btn.textContent = label), 2500);
    }
  }
}

// A minimal Word document: one paragraph per line of the resume.
function docxParts() {
  const x = (t) => esc(t).replace(/&quot;/g, '"');
  const run = (t, bold, size) => `<w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
  const p = (inner, extra = '', after = 60) => `<w:p><w:pPr><w:spacing w:after="${after}"/>${extra}</w:pPr>${inner}</w:p>`;
  return { run, p };
}

function docxBlob(body) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'blob' });
}

// A minimal Word document: one paragraph per line of the resume.
async function buildDocx(r) {
  const { run, p } = docxParts();
  const parts = [p(run(r.name, true, 36))];
  if (r.headline) parts.push(p(run(r.headline, false, 22)));
  if (r.contact) parts.push(p(run(r.contact, false, 19)));
  const heading = (t) => p(run(t.toUpperCase(), true, 21), '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="888888"/></w:pBdr><w:spacing w:before="200" w:after="80"/>');
  if (r.summary) parts.push(heading('Summary'), p(run(r.summary, false, 21)));
  for (const s of r.sections || []) {
    parts.push(heading(s.title));
    for (const e of s.entries || []) {
      const head = [e.heading, e.subheading].filter(Boolean).join(', ');
      if (head || e.dates) parts.push(p(run(head, true, 21) + (e.dates ? `<w:r><w:tab/></w:r>${run(e.dates, false, 21)}` : ''), '<w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs>'));
      for (const b of e.bullets || []) parts.push(p(run('\u2022\t' + b, false, 21), '<w:tabs><w:tab w:val="left" w:pos="284"/></w:tabs><w:ind w:left="284" w:hanging="284"/>'));
    }
  }
  return docxBlob(parts.join(''));
}

// The cover letter as Word: her name, the date, then the (edited) letter text.
function buildLetterDocx(name, text) {
  const { run, p } = docxParts();
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const body = [p(run(name, true, 28)), p(run(date, false, 21), '', 240),
    ...text.split(/\n\s*\n/).map((para) => p(para.split('\n').map((line, i) => (i ? '<w:r><w:br/></w:r>' : '') + run(line, false, 22)).join(''), '', 180))];
  return docxBlob(body.join(''));
}
window.__buildDocx = buildDocx;
window.__buildLetterDocx = buildLetterDocx; // used by the automated check

const currentT = () => state.tailored[view.target?.id];
const base = () => `${current().name} - ${view.target.company || view.target.title}`.replace(/[^\w .-]+/g, '').trim().slice(0, 70);
function keepEdits() {
  const t = currentT();
  if (!t) return;
  t.letterText = $('#letter').value;
  t.email = { subject: $('#email-subject').value, body: $('#email-body').value };
  put(`t_${view.target.id}`, t);
}
for (const id of ['#letter', '#email-subject', '#email-body']) $(id).addEventListener('change', keepEdits);

$('#dl-docx').onclick = async (e) => offer(`${base()} - Resume.docx`, await buildDocx(current()), e.target);
$('#dl-letter').onclick = async (e) => { keepEdits(); offer(`${base()} - Cover letter.docx`, await buildLetterDocx(current().name, $('#letter').value), e.target); };
$('#dl-package').onclick = async (e) => {
  keepEdits();
  const zip = new JSZip();
  zip.file(`${base()} - Resume.docx`, await buildDocx(current()));
  zip.file(`${base()} - Cover letter.docx`, await buildLetterDocx(current().name, $('#letter').value));
  zip.file('Email.txt', `Subject: ${$('#email-subject').value}\n\n${$('#email-body').value}\n`);
  await offer(`${base()} - Application.zip`, await zip.generateAsync({ type: 'blob' }), e.target);
  $('#package-msg').textContent = 'Attach the two Word files to your email. When it is sent, choose "Mark as applied".';
};
$('#copy-email').onclick = async (e) => {
  try {
    await navigator.clipboard.writeText(`Subject: ${$('#email-subject').value}\n\n${$('#email-body').value}`);
    e.target.textContent = 'Copied';
  } catch {
    e.target.textContent = 'Copy is blocked here; select the text instead';
  }
  setTimeout(() => (e.target.textContent = 'Copy email'), 2000);
};
$('#mark-applied').onclick = (e) => {
  setStage(view.target.id, 'applied');
  e.target.textContent = 'Applied ✓';
  renderJobs();
};
$('#dl-html').onclick = (e) => offer(fileName('.html'), resumeToHtml(current()), e.target);
$('#copy-md').onclick = async (e) => {
  const md = resumeToMarkdown(current());
  try {
    await navigator.clipboard.writeText(md);
    e.target.textContent = 'Copied';
  } catch {
    e.target.textContent = 'Copy is blocked here; use a download';
  }
  setTimeout(() => (e.target.textContent = 'Copy as Markdown'), 2000);
};

// ---------- resume and keywords ----------

$('#save-resume').onclick = async () => {
  state.resume = $('#resume-text').value;
  state.candidate = $('#candidate-text').value;
  await put('candidate', { text: state.candidate });
  await put('resume', { text: state.resume });
  $('#resume-msg').textContent = mine ? 'Resume saved.' : '';
};

$('#extract-profile').onclick = async (e) => {
  const msg = $('#resume-msg');
  state.resume = $('#resume-text').value;
  if (!state.resume.trim()) return void (msg.textContent = 'Paste the resume first.');
  e.target.disabled = true;
  msg.textContent = 'Reading the resume...';
  try {
    await put('resume', { text: state.resume });
    state.candidate = $('#candidate-text').value;
    const p = await ask(AGENTS.profile, AGENTS.profile.user(state.resume + (state.candidate ? `\n\nSkills and constraints:\n${state.candidate}` : '')), 'default');
    state.profile = { ...state.profile, ...p };
    // Keywords are shared with Claude's collector; the resume itself is not.
    await db?.doc('meta/profile').set(state.profile).catch(() => {});
    rescore();
    renderProfile();
    renderJobs();
    msg.textContent = 'Search keywords updated. Listings are re-ranked, and the next collection will use them.';
  } catch (err) {
    msg.textContent = sampleError(err);
  }
  e.target.disabled = false;
};

// ---------- start ----------

(async function init() {
  renderJobs();
  const use = (name) => window.claude?.use ? window.claude.use(name) : Promise.resolve(null);
  const [d, user, s, dl, m] = await Promise.all(['db', 'user', 'sample', 'downloads', 'mcp'].map(use));
  db = d; sample = s; downloads = dl; mcp = m;
  if (!mcp) indeedMsg('Indeed search works when this page is open on claude.ai with the Indeed connector added.');
  if (!db) {
    $('#status').textContent = '';
    return notice('Listings and saved data are unavailable in this view. Open this page on claude.ai while signed in.');
  }
  const timer = setTimeout(() => notice('Listings are taking a long time to load. Check the connection and reopen the page.'), 10000);
  try {
    const id = await user?.id();
    if (id) mine = db.collection(`data/users/${id}`);
    const [jobs, meta, own] = await Promise.all([
      db.collection('jobs').limit(1000).get(),
      db.collection('meta').get(),
      mine ? mine.limit(1000).get() : { docs: [] },
    ]);
    clearTimeout(timer);
    state.jobs = jobs.docs.map((x) => ({ id: x.id, ...x.data() }));
    for (const m of meta.docs) {
      if (m.id === 'status') state.status = m.data();
      if (m.id === 'profile') state.profile = { ...DEFAULT_PROFILE, ...m.data() };
    }
    for (const x of own.docs) {
      const v = x.data();
      if (x.id === 'resume') state.resume = v.text || '';
      else if (x.id === 'candidate') state.candidate = v.text || '';
      else if (x.id === 'state') { state.jobState = v.map || {}; state.stageLog = v.log || {}; state.jobNotes = v.notes || {}; }
      else if (x.id.startsWith('l_')) state.labTexts[x.id.slice(2)] = v.text || '';
      else if (x.id.startsWith('t_')) state.tailored[x.id.slice(2)] = v;
      else if (x.id.startsWith('d_')) state.descriptions[x.id.slice(2)] = v.text || '';
      else if (x.id.startsWith('c_')) state.captured.push(v);
      else if (x.id.startsWith('i_') && !state.jobs.some((j) => j.id === v.id)) state.jobs.push(v);
    }
    state.captured.sort((a, b) => String(b.firstSeen).localeCompare(String(a.firstSeen)));
  } catch (e) {
    clearTimeout(timer);
    notice(`Could not load data (${e.code || e.message}).`);
  }
  $('#resume-text').value = state.resume;
  $('#candidate-text').value = state.candidate;
  rescore();
  renderStatus();
  renderProfile();
  renderJobs();
})();
