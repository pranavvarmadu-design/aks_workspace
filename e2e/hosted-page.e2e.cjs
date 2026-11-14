// End-to-end check of the Claude-hosted page (artifact/dist/job-portal.html) in Chromium,
// with stand-ins for the page's runtime: storage, signed-in user, Claude, downloads and Indeed.
// Run: node artifact/build.mjs && node e2e/hosted-page.e2e.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'artifact/dist/job-portal.html'), 'utf8');
const html = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + page + '</body></html>';
const jszip = path.join(ROOT, 'node_modules/jszip/dist/jszip.min.js');

const INDEED_LIST = `**Job Title:** Research Fellow (Plant Biotechnology and Biochemistry)
            **Job Id:** JOBSEARCH_1
            **Company:** Nanyang Technological University
            **Location:** Singapore 639798
            **Posted on:** March 31, 2026
            **Job Type:** Full-time
            **Compensation:** N/A
            **View Job URL:** https://to.indeed.com/aahpmgy9pfg2
`;
const INDEED_IN = `**Job Title:** Research Scientist
            **Job Id:** JOBSEARCH_2
            **Company:** Syngenta Biologicals
            **Location:** Panaji, Goa
            **Posted on:** October 12, 2026
            **Job Type:** Full-time
            **Compensation:** N/A
            **View Job URL:** https://to.indeed.com/aa8rky7x8cwt
`;
const DETAIL = `### Research Fellow\n        **Job Id:** JOBSEARCH_1\n\n        ${'Plant anatomy and microscopy of floral tissue; field sampling. '.repeat(6)} International applicants are welcome to apply.`;

(async () => {
  const ok = (c, m) => { if (!c) throw new Error('FAIL ' + m); console.log('ok  ' + m); };
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ path: jszip }));
  await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }));
  await p.route('http://portal.test/', (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await p.addInitScript(({ INDEED_LIST, INDEED_IN, DETAIL }) => {
    // Survives reloads, like the real store.
    const store = JSON.parse(sessionStorage.getItem('store') || 'null') || {
      jobs: {
        a1: { title: 'Postdoc Research Associate - Bee Ecology And Conservation In Farmland', company: 'Iowa State University', location: 'Ames, IA', url: 'https://x/1', postedAt: '2026-10-27', market: 'US', category: 'university', source: 'HigherEdJobs', feed: 'Ecology', description: 'Pollination and floral field work. ' + 'x '.repeat(120) + ' Immigration sponsorship is not available for this position.' },
        a2: { title: 'Post Doctoral Researcher, Department of Plant and Soil Sciences', company: 'University of Delaware', location: 'Newark, DE', url: 'https://x/2', postedAt: '2026-11-02', market: 'US', category: 'university', source: 'HigherEdJobs', feed: 'Plant and Soil Science' },
      },
      meta: { status: { lastRun: '2026-11-14T06:00:00Z', note: 'Test data.' } },
      'data/users/u1': {},
    };
    const persist = () => sessionStorage.setItem('store', JSON.stringify(store));
    window.__store = store;
    const snap = (id, d) => ({ id, exists: !!d, data: () => d });
    const coll = (path) => ({ limit() { return this; }, get: async () => ({ docs: Object.entries(store[path] || {}).map(([k, v]) => snap(k, v)) }), doc: (id) => ({ set: async (d) => { (store[path] ??= {})[id] = d; persist(); }, delete: async () => { delete store[path][id]; persist(); } }) });
    const prompts = [];
    window.__prompts = prompts;
    const reply = (prompt) => {
      if (prompt.startsWith('From this job posting')) return { title: 'Senior Scientist', company: 'GreenGene', location: 'Pune' };
      if (prompt.startsWith('You are a hiring analyst')) return { roleSummary: 'x', documentStyle: 'industry_resume', mustHave: ['CRISPR'], niceToHave: [], keywords: [], responsibilities: [], applicationNotes: 'Two referees', screen: { sponsorship: 'not_applicable', requiredSheLacks: ['CRISPR'], strengthsMatched: [], coreOutput: 'constructs', verdict: 'skip', reason: 'CRISPR is required and is on her does-not-have list.' } };
      if (prompt.startsWith('You tailor')) return { name: 'Test Person', headline: 'Plant biologist', contact: 't@e.x', summary: 'Summary', sections: [{ title: 'Experience', entries: [{ heading: 'RA', subheading: 'Inst', dates: '2021-2025', bullets: ['Prepared samples for and interpreted GC-MS'] }] }], coverLetter: '' };
      if (prompt.startsWith('You audit')) return { matchScore: 64, unsupportedClaims: [{ claim: 'CRISPR', reason: 'not in master resume' }], coveredRequirements: [], gaps: ['CRISPR'], suggestions: [] };
      return { fieldKeywords: ['floral biology', 'pollination biology', 'plant anatomy', 'nectar'], academicRoles: ['postdoctoral'], sectorQueries: { agritech: ['agronomist'], biotech: ['plant tissue culture'], pharma: ['phytochemistry'] }, skills: ['microscopy'], seniority: 'early career' };
    };
    const sample = Object.assign(async () => ({ text: '' }), { json: async (prompt) => { prompts.push(prompt); return reply(prompt); } });
    const mcp = { callTool: async (srv, tool, input) => {
      (window.__mcp ??= []).push([srv, tool, input]);
      if (tool === 'get_job_details') return { payload: { result: DETAIL } };
      if (input.country_code === 'SG') return { payload: { result: INDEED_LIST } };
      if (input.country_code === 'IN') return { payload: { result: INDEED_IN } };
      return { payload: { result: 'No job results found.' } };
    } };
    const caps = { db: { collection: coll, doc: (pth) => { const i = pth.lastIndexOf('/'); return coll(pth.slice(0, i)).doc(pth.slice(i + 1)); } }, user: { id: async () => 'u1' }, sample, mcp, downloads: { save: async (r) => { window.__saved = { name: r.filename, size: r.data.size || r.data.length }; return { status: 'saved' }; } } };
    window.claude = { use: async (n) => caps[n] || null };
  }, { INDEED_LIST, INDEED_IN, DETAIL });

  await p.goto('http://portal.test/');
  await p.waitForSelector('.job');
  ok((await p.locator('#categories .count').allTextContents()).join() === '(2),(0),(0)', 'listings load into the right tabs');
  const first = await p.locator('.job .tags').first().textContent();
  ok(/Visa: not checked/.test(first) || /Visa: No/.test(first), 'visa labels shown');
  ok(/Visa: No/.test(await p.locator('.job').last().textContent()), 'no-sponsorship posting ranked last');

  // Resume and skills notes
  await p.click('[data-tab=resume]');
  await p.fill('#resume-text', 'Test Person. Research Associate at Inst 2021-2025. GC-MS sample preparation.');
  await p.fill('#candidate-text', 'Does not have: CRISPR, cloning. Prepares samples for but does not operate: GC-MS.');
  await p.click('#save-resume');
  await p.waitForTimeout(100);
  ok((await p.evaluate(() => window.__store['data/users/u1'].candidate.text)).includes('Does not have: CRISPR'), 'skills notes saved privately');
  await p.click('#extract-profile');
  await p.waitForFunction(() => /Search keywords updated/.test(document.querySelector('#resume-msg').textContent));
  ok(await p.evaluate(() => window.__prompts.at(-1).includes('Skills and constraints:')), 'keyword step reads the skills notes');

  // Paste a job, then the screen stops a poor match
  await p.click('[data-tab=jobs]');
  await p.fill('#add-text', 'Senior Scientist at GreenGene, Pune. Requires CRISPR and molecular cloning for trait development. ' + 'Lab work. '.repeat(10));
  await p.click('#add-job');
  await p.waitForFunction(() => /Added "Senior Scientist"/.test(document.querySelector('#add-msg').textContent));
  await p.locator('.job [data-act=tailor]').first().click();
  await p.click('#build');
  await p.waitForSelector('#screen-stop:not([hidden])');
  ok(/Probably not worth applying/.test(await p.textContent('#screen-stop')), 'screen stops a poor match before tailoring');
  ok(await p.evaluate(() => window.__prompts.at(-1).includes('<candidate>')), 'screen sees the skills notes');
  ok(await p.locator('#result').isHidden(), 'nothing tailored yet');
  await p.click('#build-anyway');
  await p.waitForSelector('#result:not([hidden])');
  const tailorPrompt = await p.evaluate(() => window.__prompts.find((x) => x.startsWith('You tailor')));
  ok(tailorPrompt.includes('<candidate>') && tailorPrompt.includes('prepared samples for and interpreted'), 'tailor gets the notes and the honesty rule');
  ok(await p.evaluate(() => window.__prompts.filter((x) => x.startsWith('You are a hiring analyst')).length === 1), 'screen not re-run after Build anyway');
  const review = await p.textContent('#review');
  ok(/Advised: skip/.test(review) && /64\/100/.test(review) && /CRISPR/.test(review), 'verdict, score and flagged claim shown');
  await p.click('#dl-docx');
  await p.waitForFunction(() => window.__saved);
  const saved = await p.evaluate(() => window.__saved);
  ok(saved.name === 'Test Person - GreenGene.docx' && saved.size > 800, 'Word file offered: ' + saved.name);

  // Indeed: one button per segment
  await p.click('[data-tab=jobs]');
  await p.click('[data-cat=university]');
  ok((await p.textContent('#indeed-run')) === 'Search all countries', 'Universities: Search all countries');
  await p.click('#indeed-run');
  await p.waitForFunction(() => /^Indeed: /.test(document.querySelector('#indeed-msg').textContent), null, { timeout: 60000 });
  const calls = await p.evaluate(() => window.__mcp);
  ok(new Set(calls.filter((c) => c[1] === 'search_jobs').map((c) => c[2].country_code)).size >= 20, 'searched 20+ countries');
  ok(/Plant Biotechnology/.test(await p.textContent('#job-list')), 'Singapore research fellow found');
  await p.click('[data-filter=SG]');
  ok(/Visa: Yes/.test(await p.locator('.job').first().textContent()), 'detail read: Visa: Yes');
  await p.click('[data-cat=industry]');
  ok((await p.textContent('#indeed-run')) === 'Search Indeed: India industry', 'India tab: Search Indeed');
  await p.click('#indeed-run');
  await p.waitForFunction(() => /^Indeed: .*India industry/.test(document.querySelector('#indeed-msg').textContent), null, { timeout: 60000 });
  ok(/Syngenta Biologicals/.test(await p.textContent('#job-list')), 'India industry result found');
  await p.click('[data-cat=saved]');
  ok(await p.locator('#indeed-bar').isHidden(), 'no Indeed button under Saved');

  // Everything is still there after a reload
  await p.reload();
  await p.waitForSelector('.job');
  ok((await p.inputValue('#candidate-text')).includes('Does not have'), 'skills notes reload');
  await p.click('[data-cat=saved]');
  ok(/Resume ready/.test(await p.textContent('#job-list')), 'tailored resume kept');
  await p.click('[data-cat=industry]');
  ok(/Syngenta Biologicals/.test(await p.textContent('#job-list')), 'Indeed results kept');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at phone width');
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.click('[data-cat=university]');
  await p.screenshot({ path: process.argv[2] || '/tmp/hosted.png', fullPage: false });
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
