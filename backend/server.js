// Scheduled job-collection backend.
//   node backend/server.js          run the API and collect on a schedule
//   node backend/server.js --once   collect once and exit (for cron)
// Configuration comes from environment variables (see .env.example).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PROFILE, DEFAULT_SOURCES } from '../core/config.js';
import { collectAll } from '../core/collect.js';
import { sendDigest } from './digest.js';
import { readPostings } from '../core/postings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const DATA_DIR = env.DATA_DIR || path.join(__dirname, 'data');
const PORT = Number(env.PORT || 8787);
const INTERVAL_H = Number(env.COLLECT_INTERVAL_HOURS || 24);
const KEEP_DAYS = Number(env.KEEP_DAYS || 45);
const API_TOKEN = env.API_TOKEN || '';

const file = (name) => path.join(DATA_DIR, name);
const read = (name, fallback) => {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch { return fallback; }
};
const write = (name, data) => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file(name) + '.tmp', JSON.stringify(data));
  fs.renameSync(file(name) + '.tmp', file(name));
};

export const loadConfig = () => {
  const saved = read('config.json', {});
  return { profile: { ...DEFAULT_PROFILE, ...saved.profile }, sources: { ...DEFAULT_SOURCES, ...saved.sources } };
};

// Merges a fresh collection into the store, keeping the first-seen date.
export function mergeJobs(existing, fresh, now = new Date()) {
  const byId = new Map(existing.map((j) => [j.id, j]));
  const added = [];
  for (const j of fresh) {
    const old = byId.get(j.id);
    if (old) byId.set(j.id, { ...j, description: j.description || old.description || '', firstSeen: old.firstSeen, lastSeen: now.toISOString() });
    else {
      const n = { ...j, firstSeen: now.toISOString(), lastSeen: now.toISOString() };
      byId.set(j.id, n);
      added.push(n);
    }
  }
  const cutoff = now.getTime() - KEEP_DAYS * 864e5;
  const jobs = [...byId.values()].filter((j) => new Date(j.lastSeen).getTime() >= cutoff);
  return { jobs, added };
}

let running = null;
export function collect() {
  running ??= (async () => {
    const { profile, sources } = loadConfig();
    const started = new Date();
    const { jobs: fresh, report } = await collectAll({
      profile, sources,
      keys: { adzunaAppId: env.ADZUNA_APP_ID, adzunaAppKey: env.ADZUNA_APP_KEY },
    });
    const { jobs, added } = mergeJobs(read('jobs.json', []), fresh, started);
    // Read posting pages for visa sponsorship and requirements (robots.txt obeyed, 4 s apart).
    const texts = await readPostings(fetch, jobs, { limit: Number(env.READ_POSTINGS_PER_RUN || 40), delayMs: 4000 });
    for (const j of jobs) if (texts[j.id]) Object.assign(j, texts[j.id].closed ? { closed: true } : { description: texts[j.id].text });
    write('jobs.json', jobs.filter((j) => !j.closed));
    const status = { lastRun: started.toISOString(), total: jobs.length, added: added.length, report };
    write('status.json', status);
    console.log(`[collect] ${fresh.length} fetched, ${added.length} new, ${jobs.length} stored; ${report.filter((r) => !r.ok).length} source errors`);
    if (added.length) await sendDigest(added, env).catch((e) => console.error('[digest]', e.message));
    return status;
  })().finally(() => { running = null; });
  return running;
}

const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const readBody = (req) => new Promise((resolve, reject) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 1e6) reject(new Error('body too large')); });
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
});

export const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  // Only the extension (or a local page) may call this API from a browser.
  if (/^(chrome-extension:\/\/|http:\/\/localhost(:\d+)?$)/.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/health') return send(res, 200, { ok: true });
  if (API_TOKEN && req.headers.authorization !== `Bearer ${API_TOKEN}`) return send(res, 401, { error: 'unauthorized' });

  try {
    if (req.method === 'GET' && url.pathname === '/api/jobs')
      return send(res, 200, { jobs: read('jobs.json', []), status: read('status.json', null), collecting: !!running });
    if (req.method === 'GET' && url.pathname === '/api/config') return send(res, 200, loadConfig());
    if (req.method === 'PUT' && url.pathname === '/api/config') {
      const body = await readBody(req);
      write('config.json', { profile: body.profile, sources: body.sources });
      return send(res, 200, loadConfig());
    }
    if (req.method === 'POST' && url.pathname === '/api/collect') {
      collect().catch((e) => console.error('[collect]', e));
      return send(res, 202, { started: true });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 400, { error: String(e.message || e) });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--once')) {
    await collect();
  } else {
    server.listen(PORT, () => console.log(`Job backend on http://localhost:${PORT}, collecting every ${INTERVAL_H}h`));
    const status = read('status.json', null);
    const due = !status || Date.now() - new Date(status.lastRun).getTime() > INTERVAL_H * 36e5;
    if (due) collect().catch((e) => console.error('[collect]', e));
    setInterval(() => collect().catch((e) => console.error('[collect]', e)), Math.min(INTERVAL_H * 36e5, 2 ** 31 - 1));
  }
}
