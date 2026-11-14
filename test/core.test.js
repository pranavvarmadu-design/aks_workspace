import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILE } from '../core/config.js';
import { parseFeed, planAdzunaQueries, stripHtml } from '../core/collectors.js';
import { collectAll, classify, detectSector, scoreJob, finalise } from '../core/collect.js';
import { resumeToHtml, resumeToMarkdown } from '../core/resume.js';
import { mergeJobs } from '../backend/server.js';
import { digestHtml } from '../backend/digest.js';

const RSS = `<?xml version="1.0"?><rss><channel><title>x</title>
<item><title>Post-Doctoral Research Associate, Plant &amp;amp; Soil</title><description>Virginia Commonwealth University (Richmond, VA)</description><link>https://www.higheredjobs.com/details.cfm?JobCode=1</link><pubDate>Wed, 11 Nov 2026 09:50:01 EST</pubDate></item>
<item><title>Postdoc, Lab of X</title><description><![CDATA[<p>Cornell University (Ithaca, NY)</p>]]></description><link>https://www.higheredjobs.com/details.cfm?JobCode=2</link><pubDate>Tue, 10 Nov 2026 08:00:00 EST</pubDate></item>
</channel></rss>`;

const json = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });

function fakeFetch(calls) {
  return async (url, init) => {
    calls.push(String(url));
    const u = new URL(url);
    if (u.host === 'www.higheredjobs.com') return { ok: true, status: 200, text: async () => RSS };
    if (u.host === 'api.adzuna.com') {
      const country = u.pathname.split('/')[4];
      if (country === 'in')
        return json({ results: [{ title: 'Scientist, Bioprocess', company: { display_name: 'Acme Biologics' }, location: { display_name: 'Bengaluru' }, redirect_url: `https://adzuna.in/${encodeURIComponent(u.searchParams.get('what'))}`, description: 'Fermentation and cell culture for biologics', created: '2026-11-10T00:00:00Z' }] });
      return json({ results: [
        { title: 'Postdoctoral Fellow in Plant Biotechnology', company: { display_name: 'University of ' + country.toUpperCase() }, location: { display_name: 'Leeds' }, redirect_url: `https://adzuna/${country}/1`, description: 'molecular biology of crops', created: '2026-11-12T00:00:00Z' },
        { title: 'Sales Associate', company: { display_name: 'Retail Co' }, location: { display_name: 'X' }, redirect_url: `https://adzuna/${country}/2`, description: 'agriculture retail', created: '2026-11-12T00:00:00Z' },
      ] });
    }
    if (u.host.endsWith('myworkdayjobs.com')) {
      assert.equal(init.method, 'POST');
      if (u.host.startsWith('ntu')) return { ok: false, status: 503 };
      return json({ jobPostings: [{ title: 'Postdoctoral Fellow (Biochemistry)', externalPath: '/job/Kent-Ridge/RF_1', locationsText: 'Kent Ridge', postedOn: 'Posted 3 Days Ago' }] });
    }
    throw new Error('unexpected ' + url);
  };
}

test('parseFeed reads RSS items and decodes entities', () => {
  const items = parseFeed(RSS);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Post-Doctoral Research Associate, Plant & Soil');
  assert.equal(stripHtml(items[1].description), 'Cornell University (Ithaca, NY)');
});

test('planAdzunaQueries covers each market and India sector', () => {
  const plan = planAdzunaQueries(DEFAULT_PROFILE);
  assert.deepEqual([...new Set(plan.map((q) => q.market))].sort(), ['EMEA', 'IN', 'SG', 'US']);
  assert.ok(plan.filter((q) => q.market === 'IN').every((q) => q.sector && !q.university));
  assert.ok(plan.length <= 50, `too many API calls per run: ${plan.length}`);
});

test('classify keeps universities and India sector jobs, drops the rest', () => {
  assert.equal(classify({ market: 'US', company: 'Retail Co', title: 't', description: '' }), null);
  assert.equal(classify({ market: 'EMEA', company: 'ETH Zurich', title: 't', description: '' }).category, 'university');
  assert.equal(classify({ market: 'IN', company: 'X', title: 'Agronomy lead', description: 'seed and crop science' }).sector, 'agritech');
  assert.equal(classify({ market: 'IN', company: 'X', title: 'Accountant', description: 'ledgers' }), null);
  assert.equal(detectSector('regulatory affairs for a pharmaceutical company'), 'pharma');
});

test('scoreJob ranks a title match above a body match above none', () => {
  const p = { fieldKeywords: ['plant biotechnology', 'molecular biology'] };
  const a = scoreJob({ title: 'Plant Biotechnology Fellow', description: '' }, p);
  const b = scoreJob({ title: 'Fellow', description: 'plant biotechnology' }, p);
  const c = scoreJob({ title: 'Fellow', description: 'history' }, p);
  assert.ok(a > b && b > c && c === 0, `${a} ${b} ${c}`);
});

test('collectAll merges sources, de-duplicates and reports failures', async () => {
  const calls = [];
  const { jobs, report } = await collectAll({
    fetchFn: fakeFetch(calls), profile: DEFAULT_PROFILE, throttleMs: 0,
    sources: {
      adzuna: { enabled: true, maxDaysOld: 30, resultsPerPage: 50 },
      rss: [{ name: 'HigherEdJobs', url: 'https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=49', market: 'US', university: true }],
      workday: [
        { name: 'NUS', host: 'nus.wd3.myworkdayjobs.com', tenant: 'nus', site: 'NUS', market: 'SG', university: true },
        { name: 'NTU', host: 'ntu.wd3.myworkdayjobs.com', tenant: 'ntu', site: 'Careers', market: 'SG', university: true },
      ],
    },
    keys: { adzunaAppId: 'id', adzunaAppKey: 'key' },
  });
  assert.ok(!calls.some((u) => /linkedin|indeed/.test(u)));
  assert.ok(!jobs.some((j) => j.company === 'Retail Co'), 'non-university employer dropped');
  const uni = jobs.filter((j) => j.category === 'university');
  assert.deepEqual([...new Set(uni.map((j) => j.market))].sort(), ['EMEA', 'SG', 'US']);
  assert.equal(jobs.filter((j) => j.title === 'Postdoctoral Fellow in Plant Biotechnology').length, 7, 'one per country, repeats across keyword searches collapsed');
  assert.ok(jobs.some((j) => j.category === 'industry' && j.sector === 'biotech'));
  const nus = jobs.find((j) => j.source === 'workday');
  assert.equal(nus.url, 'https://nus.wd3.myworkdayjobs.com/en-US/NUS/job/Kent-Ridge/RF_1');
  const hej = jobs.find((j) => j.source === 'rss');
  assert.equal(hej.company, 'Virginia Commonwealth University');
  assert.equal(hej.location, 'Richmond, VA');
  assert.ok(hej.postedAt.startsWith('2026-11-11'));
  assert.ok(report.some((r) => !r.ok && /NTU/.test(r.source) && /503/.test(r.error)));
  assert.ok(jobs[0].score >= jobs.at(-1).score);
});

test('collectAll explains a missing Adzuna key instead of failing', async () => {
  const { jobs, report } = await collectAll({ fetchFn: fakeFetch([]), profile: DEFAULT_PROFILE, throttleMs: 0, sources: { adzuna: { enabled: true } } });
  assert.equal(jobs.length, 0);
  assert.match(report[0].error, /Adzuna API key/);
});

test('mergeJobs keeps first-seen dates and reports only new jobs', () => {
  const t0 = new Date('2026-11-01T00:00:00Z'), t1 = new Date('2026-11-02T00:00:00Z');
  const first = mergeJobs([], [{ id: 'a', title: 'A' }], t0);
  const second = mergeJobs(first.jobs, [{ id: 'a', title: 'A2' }, { id: 'b', title: 'B' }], t1);
  assert.deepEqual(second.added.map((j) => j.id), ['b']);
  assert.equal(second.jobs.find((j) => j.id === 'a').firstSeen, t0.toISOString());
  assert.equal(second.jobs.find((j) => j.id === 'a').title, 'A2');
  const later = mergeJobs(second.jobs, [], new Date('2027-03-01T00:00:00Z'));
  assert.equal(later.jobs.length, 0, 'stale listings pruned');
});

test('resume and digest rendering escape content', () => {
  const r = { name: 'A <B>', headline: 'Scientist', contact: 'a@b.c', summary: 'S', sections: [{ title: 'Experience', entries: [{ heading: 'Lab', subheading: 'Uni', dates: '2020-2024', bullets: ['Did <x>'] }] }] };
  const html = resumeToHtml(r);
  assert.ok(html.includes('A &lt;B&gt;') && html.includes('Did &lt;x&gt;') && !html.includes('<x>'));
  assert.match(resumeToMarkdown(r), /## Experience\n\*\*Lab, Uni\*\* \(2020-2024\)\n- Did <x>/);
  const d = digestHtml([{ category: 'university', market: 'SG', title: '<i>T</i>', company: 'NUS', url: 'https://x', score: 50 }]);
  assert.ok(d.includes('Universities: Singapore') && d.includes('&lt;i&gt;'));
});

test('university listings are limited to postdoc roles', () => {
  const raw = [
    { title: 'Postdoctoral Research Associate - Plant Breeding', company: 'Iowa State University', url: 'https://x/1', market: 'US', university: true, description: '' },
    { title: 'Fellow (Post Doc)', company: 'Kansas State University', url: 'https://x/2', market: 'US', university: true, description: '' },
    { title: 'Assistant Professor of Biology', company: 'Gordon State College', url: 'https://x/3', market: 'US', university: true, description: '' },
    { title: 'Agronomist', company: 'DeltaAgri', url: 'https://x/4', market: 'IN', sector: 'agritech', description: 'crop science' },
  ];
  const titles = finalise(raw, DEFAULT_PROFILE).map((j) => j.title).sort();
  assert.deepEqual(titles, ['Agronomist', 'Fellow (Post Doc)', 'Postdoctoral Research Associate - Plant Breeding']);
  assert.equal(finalise(raw, { ...DEFAULT_PROFILE, universityRolesOnly: false }).length, 4);
});
