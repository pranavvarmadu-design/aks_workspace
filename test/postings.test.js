import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, robotsAllows, postingTextFromHtml, readPostings } from '../core/postings.js';

const HEJ_ROBOTS = '# /robots.txt\r\n\r\nUser-agent: *\r\nDisallow: /ClickThru\r\nDisallow: /clickthru\r\nDisallow: /js\r\nDisallow: /jscript\r\n';

test('robots.txt rules are obeyed', async () => {
  assert.deepEqual(parseRobots(HEJ_ROBOTS), ['/ClickThru', '/clickthru', '/js', '/jscript']);
  assert.deepEqual(parseRobots('User-agent: Googlebot\nDisallow: /a\n\nUser-agent: *\nDisallow: /b'), ['/b']);
  const fetchFn = async () => ({ ok: true, text: async () => HEJ_ROBOTS });
  assert.equal(await robotsAllows(fetchFn, 'https://www.higheredjobs.com/details.cfm?JobCode=1'), true);
  assert.equal(await robotsAllows(fetchFn, 'https://www.higheredjobs.com/clickthru/x'), false);
  assert.equal(await robotsAllows(fetchFn, 'https://www.linkedin.com/jobs/view/1'), false, 'LinkedIn is never read automatically');
});

test('posting text comes from JSON-LD, even with trailing commas', () => {
  const html = '<html><script type="application/ld+json">{"@type":"JobPosting","title":"Postdoc","description":"<p>Floral anatomy.</p><p>J-1 sponsorship available.</p>",}</script><body>menu</body></html>';
  assert.match(postingTextFromHtml(html), /Floral anatomy\.\s+J-1 sponsorship available\./);
  assert.match(postingTextFromHtml('<html><body><nav>x</nav><main>Plain text posting</main></body></html>'), /Plain text posting/);
});

test('readPostings reads unread postings one at a time and skips the rest', async () => {
  const long = 'Field sampling and microscopy. '.repeat(10);
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    if (url.endsWith('/robots.txt')) return { ok: true, text: async () => 'User-agent: *\nDisallow: /private' };
    return { ok: true, text: async () => `<main>${long} ${url}</main>` };
  };
  const jobs = [
    { id: 'a', url: 'https://u.example/details?1' },
    { id: 'b', url: 'https://u.example/details?2', description: long },
    { id: 'c', url: 'https://u.example/private/3' },
    { id: 'd', url: 'https://other.example/4' },
    { id: 'e', url: 'https://u.example/details?5' },
  ];
  const got = await readPostings(fetchFn, jobs, { delayMs: 0, limit: 5, canRead: async (u) => !u.includes('other.example') });
  assert.deepEqual(Object.keys(got).sort(), ['a', 'e']);
  assert.equal(got.a.closed, false);
  assert.ok(!calls.some((u) => u.includes('private') || u.includes('other.example') || u.endsWith('?2')));
  assert.equal(calls.filter((u) => u.endsWith('/robots.txt')).length, 1, 'robots.txt fetched once per site');
});

test('closed postings are detected, not read as "visa not mentioned"', async () => {
  const deleted = '<html><body>Job Detail Position Deleted on 11/13/2026. This position is no longer an active posting on HigherEdJobs. Postdoctoral Research Associate</body></html>';
  const fetchFn = async (url) => url.endsWith('/robots.txt') ? { ok: false, status: 404 }
    : url.includes('gone') ? { ok: false, status: 410 } : { ok: true, status: 200, text: async () => deleted };
  const got = await readPostings(fetchFn, [{ id: 'd', url: 'https://h.example/details?1' }, { id: 'g', url: 'https://h.example/gone' }], { delayMs: 0 });
  assert.deepEqual(got, { d: { closed: true, text: '' }, g: { closed: true, text: '' } });
});
