// Hosted version of the job finder: a Claude artifact page.
// Listings live in the page's shared database (Claude collects them);
// the resume and saved jobs live in the viewer's private space.
import { MARKETS, SECTORS, DEFAULT_PROFILE } from '../core/config.js';
import { scoreJob } from '../core/collect.js';
import { AGENTS } from '../core/prompts.js';
import { esc, resumeToHtml, resumeToMarkdown } from '../core/resume.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const view = { cat: 'university', filter: 'all', query: '', target: null };
const state = { jobs: [], captured: [], jobState: {}, tailored: {}, descriptions: {}, resume: '', profile: DEFAULT_PROFILE, status: null };
let db, mine, sample, downloads;

const notice = (msg) => { $('#notice').hidden = !msg; $('#notice').textContent = msg || ''; };

function showTab(name) {
  for (const b of $$('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  for (const s of $$('main > section')) s.hidden = s.id !== `tab-${name}`;
  scrollTo(0, 0);
}
for (const b of $$('.tabs button')) b.onclick = () => showTab(b.dataset.tab);

// ---------- jobs ----------

const allJobs = () => [...state.captured, ...state.jobs];
const stateOf = (j) => state.jobState[j.id];
const jobsFor = (cat) => cat === 'saved'
  ? allJobs().filter((j) => ['saved', 'applied'].includes(stateOf(j)))
  : state.jobs.filter((j) => j.category === cat && stateOf(j) !== 'hidden');

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
    : [['saved', 'Shortlisted'], ['applied', 'Applied']];
  $('#filters').innerHTML = [['all', 'All'], ...options]
    .map(([k, l]) => `<button data-filter="${k}" aria-pressed="${view.filter === k}">${esc(l)}</button>`).join('');
  const q = view.query.toLowerCase();
  const list = jobsFor(view.cat).filter((j) => {
    if (view.filter !== 'all') {
      const key = view.cat === 'university' ? j.market : view.cat === 'industry' ? j.sector : stateOf(j);
      if (key !== view.filter) return false;
    }
    return !q || `${j.title} ${j.company} ${j.location} ${j.description || ''} ${j.feed || ''}`.toLowerCase().includes(q);
  });
  $('#job-list').innerHTML = list.length ? list.slice(0, 200).map(jobCard).join('') : `<div class="empty">${emptyText()}</div>`;
}

function emptyText() {
  if (view.cat === 'saved') return 'Nothing saved yet. Shortlist a listing, or paste a job from LinkedIn, Indeed or a careers page below.';
  if (view.cat === 'industry' || view.filter === 'SG' || view.filter === 'EMEA')
    return 'No listings collected for this group yet. Claude adds them when it next collects listings.';
  return 'No listings match this filter.';
}

function jobCard(j) {
  const st = stateOf(j);
  const tags = [
    st === 'applied' ? '<span class="tag state">Applied</span>' : '',
    j.category === 'university' ? `<span class="tag">${esc(MARKETS[j.market]?.label || j.market || '')}</span>` : '',
    j.category === 'industry' ? `<span class="tag">${esc(SECTORS[j.sector]?.label || '')}</span>` : '',
    j.feed ? `<span class="tag">${esc(j.feed)}</span>` : '',
    j.score ? `<span class="tag ${j.score >= 50 ? 'good' : ''}">Match ${j.score}</span>` : '',
    state.tailored[j.id] ? '<span class="tag good">Resume ready</span>' : '',
    `<span class="tag">${esc(j.source || 'added by you')}</span>`,
  ].join('');
  const title = j.url ? `<a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)}</a>` : esc(j.title);
  return `<article class="card job" data-id="${esc(j.id)}">
    <h3>${title}</h3>
    <div class="meta">${esc([j.company, j.location, ago(j.postedAt || j.firstSeen)].filter(Boolean).join(' · '))}</div>
    <div class="tags">${tags}</div>
    <div class="actions">
      <button data-act="tailor" class="primary">${state.tailored[j.id] ? 'Open resume' : 'Tailor resume'}</button>
      ${st === 'saved' || st === 'applied' ? '<button data-act="unsave">Remove</button>' : '<button data-act="saved">Shortlist</button>'}
      ${st === 'applied' ? '' : '<button data-act="applied">Mark applied</button>'}
      ${st || j.category === 'captured' ? '' : '<button data-act="hidden">Hide</button>'}
    </div>
  </article>`;
}

$('#categories').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) { view.cat = b.dataset.cat; view.filter = 'all'; renderJobs(); }
};
$('#filters').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) { view.filter = b.dataset.filter; renderJobs(); }
};
$('#search').oninput = (e) => { view.query = e.target.value; renderJobs(); };

$('#job-list').onclick = async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const id = b.closest('.job').dataset.id;
  const j = allJobs().find((x) => x.id === id);
  const act = b.dataset.act;
  if (act === 'tailor') return setTarget(j);
  if (act === 'unsave') {
    delete state.jobState[id];
    if (j.category === 'captured') {
      state.captured = state.captured.filter((c) => c.id !== id);
      put(`c_${id}`, null);
    }
  } else state.jobState[id] = act;
  put('state', { map: state.jobState });
  renderJobs();
};

function rescore() {
  state.jobs = state.jobs.map((j) => ({ ...j, score: scoreJob({ title: `${j.title} ${j.feed || ''}`, description: j.description || '' }, state.profile) }))
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
  state.jobState[id] = 'saved';
  await put(`c_${id}`, j);
  await put('state', { map: state.jobState });
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
  $('#build-msg').textContent = state.resume.trim() ? '' : 'Add your resume in the My resume tab first.';
  showResult(state.tailored[j.id]);
  showTab('builder');
}

function showResult(t) {
  $('#result').hidden = !t;
  if (!t) return;
  const r = t.review;
  const list = (title, items) => items?.length ? `<strong>${title}</strong><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  $('#review').innerHTML = `<h3>Fit for this role: ${Number(r.matchScore) || 0}/100</h3>` +
    (r.unsupportedClaims?.length
      ? `<div class="warn"><strong>Check before sending.</strong> The reviewer could not find these in your master resume:<ul>${r.unsupportedClaims.map((c) => `<li>${esc(c.claim)} <span class="small">(${esc(c.reason)})</span></li>`).join('')}</ul></div>`
      : '<p class="small">Every claim was found in your master resume.</p>') +
    list('Requirements not shown in your resume', r.gaps) +
    list('Add these to your master resume if they apply', r.suggestions) +
    (t.analysis.applicationNotes ? `<strong>The listing also asks for</strong><p class="small">${esc(t.analysis.applicationNotes)}</p>` : '');
  $('#preview').innerHTML = resumeToHtml(t.resume, { standalone: false });
  $('#letter-wrap').hidden = !t.resume.coverLetter;
  $('#letter').value = t.resume.coverLetter || '';
}

$('#build').onclick = async () => {
  const j = view.target;
  const msg = $('#build-msg');
  if (!state.resume.trim()) return void (msg.textContent = 'Add your resume in the My resume tab first.');
  const description = $('#job-desc').value.trim();
  if (description !== (j.description || '')) {
    state.descriptions[j.id] = description;
    put(`d_${j.id}`, { text: description });
  }
  const job = { ...j, description };
  const btn = $('#build');
  btn.disabled = true;
  msg.textContent = '';
  $('#steps').hidden = false;
  const order = ['analyst', 'tailor', 'reviewer'];
  const mark = (step) => {
    for (const li of $$('#steps li')) {
      const i = order.indexOf(li.dataset.step), cur = order.indexOf(step);
      li.className = i < cur ? 'done' : i === cur ? 'active' : '';
    }
  };
  try {
    const opts = { coverLetter: $('#cover-letter').checked, notes: $('#notes').value.trim() };
    mark('analyst');
    const analysis = await ask(AGENTS.analyst, AGENTS.analyst.user(job), 'default');
    mark('tailor');
    const resume = await ask(AGENTS.tailor, AGENTS.tailor.user(state.resume, job, analysis, opts), 'complex');
    mark('reviewer');
    const review = await ask(AGENTS.reviewer, AGENTS.reviewer.user(state.resume, resume, analysis), 'default');
    const t = { analysis, resume, review, builtAt: new Date().toISOString() };
    state.tailored[j.id] = t;
    put(`t_${j.id}`, t);
    showResult(t);
    renderJobs();
  } catch (e) {
    msg.textContent = sampleError(e);
  }
  $('#steps').hidden = true;
  btn.disabled = false;
};

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
async function buildDocx(r) {
  const x = (s) => esc(s).replace(/&quot;/g, '"');
  const run = (t, bold, size) => `<w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
  const p = (inner, extra = '') => `<w:p><w:pPr><w:spacing w:after="60"/>${extra}</w:pPr>${inner}</w:p>`;
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
      for (const b of e.bullets || []) parts.push(p(run('•\t' + b, false, 21), '<w:tabs><w:tab w:val="left" w:pos="284"/></w:tabs><w:ind w:left="284" w:hanging="284"/>'));
    }
  }
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${parts.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'blob' });
}
window.__buildDocx = buildDocx; // used by the automated check

$('#dl-docx').onclick = async (e) => offer(fileName('.docx'), await buildDocx(current()), e.target);
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
    const p = await ask(AGENTS.profile, AGENTS.profile.user(state.resume), 'default');
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
  const [d, user, s, dl] = await Promise.all(['db', 'user', 'sample', 'downloads'].map(use));
  db = d; sample = s; downloads = dl;
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
      else if (x.id === 'state') state.jobState = v.map || {};
      else if (x.id.startsWith('t_')) state.tailored[x.id.slice(2)] = v;
      else if (x.id.startsWith('d_')) state.descriptions[x.id.slice(2)] = v.text || '';
      else if (x.id.startsWith('c_')) state.captured.push(v);
    }
    state.captured.sort((a, b) => String(b.firstSeen).localeCompare(String(a.firstSeen)));
  } catch (e) {
    clearTimeout(timer);
    notice(`Could not load data (${e.code || e.message}).`);
  }
  $('#resume-text').value = state.resume;
  rescore();
  renderStatus();
  renderProfile();
  renderJobs();
})();
