import test from 'node:test';
import assert from 'node:assert/strict';
import { collectAll } from '../core/collect.js';
import { DEFAULT_PROFILE } from '../core/config.js';

const item = (title, desc) => `<item><title><![CDATA[${title}]]></title><link>https://careers.cipla.com/job/x-${encodeURIComponent(title)}/1/?feedId=null&amp;utm_source=J2WRSS</link><description><![CDATA[${desc}]]></description><pubDate>Thu, 12 Nov 2026 00:00:00 GMT</pubDate></item>`;
const CIPLA = `<?xml version="1.0"?><rss><channel>${[
  item('Research Scientist - Phytochemistry (Vikhroli, Maharashtra, India)', '<p>PhD in Botany or Pharmacognosy. Isolation of natural actives, HPLC sample preparation. 3+ years of pharmaceutical industry experience.</p>'),
  item('Senior Team Member - Legal (Lower Parel, Maharashtra, India)', '<p>Contracts for our pharmaceutical business.</p>'),
  item('QA Inspector III (Hauppauge, New York, United States)', '<p>Pharmaceutical QA.</p>'),
].join('')}</channel></rss>`;
const SR = { content: [
  { id: '1', name: 'Research Scientist', location: { fullLocation: 'Panaji, GA, India', country: 'in' }, department: { label: 'Research' }, function: { label: 'Research' }, releasedDate: '2026-10-30T05:56:02Z' },
  { id: '2', name: 'Data Platform Engineer Manager', location: { fullLocation: 'Pune, MAHĀRĀSHTRA, India', country: 'in' }, department: { label: 'IT & Digital' }, releasedDate: '2026-11-03T00:00:00Z' },
] };
const WD = { jobPostings: [
  { title: 'Field Development Scientist - Crop Protection', externalPath: '/job/Hyderabad-India/FDS_R-1', locationsText: 'Hyderabad, India', postedOn: 'Posted 2 Days Ago' },
  { title: 'Lab Technician', externalPath: '/job/Wyoming-Illinois/Lab_R-2', locationsText: 'Wyoming, Illinois', postedOn: 'Posted Yesterday' },
] };

test('India industry: employer feeds, SmartRecruiters and Workday, India only, office jobs skipped', async () => {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    const u = new URL(url);
    const ok = (body, text) => ({ ok: true, status: 200, json: async () => body, text: async () => text ?? JSON.stringify(body) });
    if (u.host === 'careers.cipla.com') return ok(null, CIPLA);
    if (u.host === 'api.smartrecruiters.com') return ok(SR);
    if (u.host.endsWith('myworkdayjobs.com')) return ok(WD);
    throw new Error('unexpected ' + url);
  };
  const { jobs, report } = await collectAll({
    fetchFn, profile: DEFAULT_PROFILE, throttleMs: 0, keys: {},
    sources: {
      employerFeeds: [{ name: 'Cipla', base: 'https://careers.cipla.com', sector: 'pharma', keywords: ['research'] }],
      smartrecruiters: [{ company: 'SyngentaGroup', name: 'Syngenta', country: 'in', sector: 'agritech' }],
      workdayIndustry: [{ name: 'FMC', host: 'fmc.wd12.myworkdayjobs.com', tenant: 'fmc', site: 'FMC', sector: 'agritech' }],
    },
  });
  assert.ok(calls.includes('https://careers.cipla.com/services/rss/job/?locale=en_US&keywords=research'));
  const titles = jobs.map((j) => `${j.company}: ${j.title}`).sort();
  assert.deepEqual(titles, ['Cipla: Research Scientist - Phytochemistry', 'FMC: Field Development Scientist - Crop Protection', 'Syngenta: Research Scientist']);
  const cipla = jobs.find((j) => j.company === 'Cipla');
  assert.equal(cipla.location, 'Vikhroli, Maharashtra, India');
  assert.equal(cipla.category, 'industry');
  assert.match(cipla.description, /3\+ years of pharmaceutical industry experience/);
  assert.equal(cipla.url, 'https://careers.cipla.com/job/x-Research%20Scientist%20-%20Phytochemistry%20(Vikhroli%2C%20Maharashtra%2C%20India)/1/');
  assert.equal(jobs.find((j) => j.company === 'Syngenta').url, 'https://jobs.smartrecruiters.com/SyngentaGroup/1');
  assert.ok(report.every((r) => r.ok), JSON.stringify(report));
});
