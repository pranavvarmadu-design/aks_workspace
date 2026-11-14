// End-to-end test: loads the built extension in Chromium against a local backend,
// a fake job page and a mocked Claude API. Needs Playwright: npm run e2e
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { finalise } from '../core/collect.js';
import { normaliseJob } from '../core/collectors.js';
import { DEFAULT_PROFILE } from '../core/config.js';

import os from 'node:os';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const S = fs.mkdtempSync(path.join(os.tmpdir(), 'jobfinder-e2e-'));
const DATA = path.join(S, 'data');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok  ' + m); };

// seed the backend store
const now = new Date().toISOString();
const raw = [
  ['adzuna', { title: 'Research Fellow in Plant Biotechnology', company: 'University of Leeds', location: 'Leeds, UK', url: 'https://e.x/1', description: 'molecular biology of crops', market: 'EMEA' }],
  ['rss', { title: 'Assistant Professor, Plant and Soil Science', company: 'Cornell University', location: 'Ithaca, NY', url: 'https://e.x/2', market: 'US', university: true }],
  ['workday', { title: 'Research Fellow (Biochemistry)', company: 'NUS', location: 'Kent Ridge', url: 'https://e.x/3', market: 'SG', university: true }],
  ['adzuna', { title: 'Agronomist, Seed Trials', company: 'DeltaAgri', location: 'Hyderabad', url: 'https://e.x/4', description: 'crop science and seed', market: 'IN', sector: 'agritech' }],
  ['adzuna', { title: 'Formulation Scientist', company: 'Medica Labs', location: 'Ahmedabad', url: 'https://e.x/5', description: 'pharmaceutical formulation', market: 'IN', sector: 'pharma' }],
].map(([s, j]) => normaliseJob(s, j));
fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(path.join(DATA, 'jobs.json'), JSON.stringify(finalise(raw, DEFAULT_PROFILE).map((j) => ({ ...j, firstSeen: now, lastSeen: now }))));
fs.writeFileSync(path.join(DATA, 'status.json'), JSON.stringify({ lastRun: now, report: [{ source: 'NTU: x', ok: false, error: 'HTTP 503' }] }));
fs.rmSync(path.join(DATA, 'config.json'), { force: true });
const backend = spawn('node', [path.join(ROOT, 'backend/server.js')], { env: { ...process.env, PORT: '8799', DATA_DIR: DATA, API_TOKEN: 'tok', COLLECT_INTERVAL_HOURS: '9999' }, stdio: 'inherit' });

// a job page like the ones she would capture
const page1 = `<html><head><title>Job</title><script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: 'Senior Scientist, Crop Genomics', hiringOrganization: { name: 'GreenGene Pvt Ltd' }, jobLocation: { address: { addressLocality: 'Pune', addressCountry: 'IN' } }, description: '<p>Lead genomics for seed traits. Requires PCR, CRISPR and Python.</p>', datePosted: '2026-11-10' })}</script></head><body><h1>Senior Scientist</h1></body></html>`;
const web = http.createServer((q, r) => r.end(page1)).listen(8798);

const ctx = await chromium.launchPersistentContext(path.join(S, 'profile'), {
  channel: 'chromium', headless: true, viewport: { width: 420, height: 900 },
  args: ['--disable-extensions-except=' + path.join(ROOT, 'extension'), '--load-extension=' + path.join(ROOT, 'extension')],
});
const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
const extId = sw.url().split('/')[2];

// mock the Claude API with a streamed response per agent
const tailoredDoc = { name: 'Test Person', headline: 'Plant molecular biologist', contact: 'test@example.com', summary: 'Tailored summary for crop genomics.', sections: [{ title: 'Experience', entries: [{ heading: 'Research Associate', subheading: 'Some Institute', dates: '2021-2025', bullets: ['Ran PCR and CRISPR edits in rice.'] }] }], coverLetter: 'Dear team, ...' };
const replies = {
  hiring: { roleSummary: 'x', documentStyle: 'industry_resume', mustHave: ['PCR'], niceToHave: [], keywords: ['CRISPR'], responsibilities: [], applicationNotes: 'Two referees' },
  tailor: tailoredDoc,
  audit: { matchScore: 78, unsupportedClaims: [{ claim: 'Python', reason: 'not in master resume' }], coveredRequirements: ['PCR'], gaps: ['Python'], suggestions: ['Have you used Python?'] },
  read: { fieldKeywords: ['crop genomics', 'plant molecular biology', 'CRISPR', 'rice'], academicRoles: ['postdoctoral'], sectorQueries: { agritech: ['seed scientist'], biotech: [], pharma: [] }, skills: ['PCR'], seniority: 'early career' },
};
const apiBodies = [];
await ctx.route('https://api.anthropic.com/**', async (route) => {
  const req = route.request();
  const body = req.postDataJSON();
  apiBodies.push({ body, headers: req.headers() });
  const sys = body.system;
  const reply = sys.startsWith('You are a hiring') ? replies.hiring : sys.startsWith('You tailor') ? replies.tailor : sys.startsWith('You audit') ? replies.audit : replies.read;
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const sse = ev('message_start', { message: { id: 'm', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } } }) +
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) +
    ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: JSON.stringify(reply) } }) +
    ev('content_block_stop', { index: 0 }) +
    ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } }) + ev('message_stop', {});
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse });
});

const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto(`chrome-extension://${extId}/sidepanel.html`);
ok(await p.locator('#tab-resume').isVisible(), 'first run opens on the resume tab');

// settings: backend + key
await p.click('[data-tab=settings]');
await p.fill('#s-anthropicKey', 'sk-ant-test');
await p.fill('#s-backendUrl', 'http://localhost:8799');
await p.fill('#s-backendToken', 'tok');
await p.click('#save-settings');
await p.waitForFunction(() => /backend now uses/.test(document.querySelector('#settings-msg').textContent));
ok(JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'))).profile.fieldKeywords.length === 4, 'settings pushed to the backend');

// jobs via backend
await p.click('[data-tab=jobs]');
await p.click('#refresh');
await p.waitForSelector('.job');
const counts = await p.locator('#categories .count').allTextContents();
ok(counts.join() === '(3),(2),(0)', 'category counts ' + counts.join());
await p.click('[data-filter=SG]');
ok((await p.locator('.job h3').allTextContents()).join() === 'Research Fellow (Biochemistry)', 'market filter');
await p.click('[data-cat=industry]');
await p.click('[data-filter=pharma]');
ok((await p.locator('.job h3').allTextContents()).join() === 'Formulation Scientist', 'sector filter');
ok(/1 source failed/.test(await p.textContent('#status')), 'failed source is reported');
await p.click('[data-filter=all]');
await p.screenshot({ path: path.join(S, 'jobs.png') });

// capture from a page she is viewing
const jobTab = await ctx.newPage();
await jobTab.goto('http://localhost:8798/job');
await p.evaluate(async () => {
  const [t] = await chrome.tabs.query({ url: 'http://localhost/*' });
  await chrome.tabs.update(t.id, { active: true });
});
await p.evaluate(() => document.querySelector('#capture').click());
await p.waitForFunction(() => /Saved "Senior Scientist, Crop Genomics"/.test(document.querySelector('#status').textContent));
ok(await p.locator('.job h3').first().textContent() === 'Senior Scientist, Crop Genomics', 'captured job appears under Saved');
ok(/GreenGene Pvt Ltd · Pune, IN/.test(await p.locator('.job .meta').first().textContent()), 'captured employer and location');

// resume: keywords from resume, then tailor
await p.bringToFront();
await p.click('.job [data-act=tailor]');
await p.fill('#resume-text', 'Test Person\nResearch Associate, Some Institute 2021-2025\nPCR, CRISPR in rice');
await p.click('#extract-profile');
await p.waitForFunction(() => /Search keywords updated: crop genomics/.test(document.querySelector('#resume-msg').textContent));
ok(JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'))).profile.fieldKeywords[0] === 'crop genomics', 'resume keywords reach the backend');
await p.check('#cover-letter');
await p.click('#build');
await p.waitForSelector('#result:not([hidden])');
ok(/Fit for this role: 78\/100/.test(await p.textContent('#review')), 'review score shown');
ok(/could not find these.*Python/s.test(await p.textContent('#review')), 'unsupported claim flagged');
ok(/Ran PCR and CRISPR edits in rice/.test(await p.textContent('#preview')), 'tailored resume preview');
ok((await p.inputValue('#letter')).startsWith('Dear team'), 'cover letter shown');
const t = apiBodies.find((b) => b.body.system.startsWith('You tailor'));
ok(t.body.model === 'claude-opus-5-5' && t.body.stream === true && t.body.output_config.format.type === 'json_schema' && t.body.fallbacks === 'default', 'Claude request shape');
ok(t.body.messages[0].content.includes('Lead genomics for seed traits') === false && apiBodies.find((b) => b.body.system.startsWith('You are a hiring')).body.messages[0].content.includes('Lead genomics for seed traits'), 'job description goes to the analyst');
ok(t.headers.authorization === 'Bearer sk-ant-test' && /server-side-fallback-2026-07-01/.test(t.headers['anthropic-beta']), 'auth and beta headers');
await p.screenshot({ path: path.join(S, 'resume.png'), fullPage: true });

// downloads and print page
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#download-doc')]);
ok(dl.suggestedFilename() === 'Test Person - GreenGene Pvt Ltd.doc', 'Word download ' + dl.suggestedFilename());
const [printPage] = await Promise.all([ctx.waitForEvent('page'), p.click('#print')]);
await printPage.addInitScript(() => { window.print = () => {}; });
await printPage.waitForSelector('h1');
ok(await printPage.textContent('h1') === 'Test Person', 'print page renders the resume');

// state persists
await p.reload();
await p.click('[data-cat=saved]');
ok(/Resume ready/.test(await p.locator('.job .tags').first().textContent()), 'tailored resume persists after reload');
ok(errors.length === 0, 'no console errors: ' + errors.join(' | '));

await ctx.close(); web.close(); backend.kill();
