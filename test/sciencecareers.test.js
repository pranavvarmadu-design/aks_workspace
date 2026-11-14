import test from 'node:test';
import assert from 'node:assert/strict';
import { rssCollect } from '../core/collectors.js';
import { finalise } from '../core/collect.js';
import { DEFAULT_PROFILE, marketOf } from '../core/config.js';

// Trimmed from the real Science Careers feed.
const item = (t, d, link) => `<item><title>${t}</title><description>${d}</description><link>${link}?TrackID=9&amp;utm_source=rss</link><pubDate>Fri, 13 Nov 2026 05:00:00 -0500</pubDate></item>`;
const FEED = `<rss><channel>${[
  item('Ellison Institute of Technology: Postdoctoral Research Fellow - Generative Biology Institute', '\nCompetitive salary:\n\nEllison Institute of Technology:\nAt the Ellison Institute of Technology (EIT), we are on a mission.\nOxford, Oxfordshire\n', 'https://jobs.sciencecareers.org/job/680772/x/'),
  item('Max Planck Institute for Plant Breeding Research (MPIPZ): Postdoctoral Researcher, Plant Developmental Biology (m/f/d)', '\nTVöD Bund:\n\nMax Planck Institute for Plant Breeding Research (MPIPZ):\nPostdoc in plant organ development and floral anatomy.\nCologne, Nordrhein-Westfalen (DE)\n', 'https://jobs.sciencecareers.org/job/1/y/'),
  item('University of Nebraska-Lincoln: Open Rank Professor - Plant Metabolism', '\nTenure-track:\n\nUniversity of Nebraska-Lincoln:\nOpen Rank Professor.\nLincoln, Nebraska\n', 'https://jobs.sciencecareers.org/job/2/z/'),
].join('')}</channel></rss>`;

test('Science Careers items: employer, title, location and market', async () => {
  const fetchFn = async () => ({ ok: true, text: async () => FEED });
  const items = await rssCollect(fetchFn, { name: 'SC', url: 'https://jobs.sciencecareers.org/jobsrss/?keywords=x', format: 'madgex', market: 'US' });
  assert.deepEqual(items[1], { title: 'Postdoctoral Researcher, Plant Developmental Biology (m/f/d)', company: 'Max Planck Institute for Plant Breeding Research (MPIPZ)', location: 'Cologne, Nordrhein-Westfalen (DE)', url: 'https://jobs.sciencecareers.org/job/1/y/', postedAt: 'Fri, 13 Nov 2026 05:00:00 -0500', description: 'Postdoc in plant organ development and floral anatomy.', market: 'EMEA' });
  assert.equal(items[0].market, 'EMEA', 'Oxford, Oxfordshire is EMEA');
  assert.equal(items[2].market, 'US');
  const kept = finalise(items.map((j) => ({ ...j, university: true, id: j.url })), DEFAULT_PROFILE).map((j) => j.title);
  assert.deepEqual(kept, ['Postdoctoral Researcher, Plant Developmental Biology (m/f/d)'], 'faculty and generative-biology posts dropped');
});

test('marketOf reads country codes, US states and place names', () => {
  assert.equal(marketOf('Aarhus, Midtjylland (DK)'), 'EMEA');
  assert.equal(marketOf('Columbia, Missouri (US)'), 'US');
  assert.equal(marketOf('Geneva, New York'), 'US');
  assert.equal(marketOf('Ithaca, NY'), 'US');
  assert.equal(marketOf('Guelph, Ontario'), 'OTHER');
  assert.equal(marketOf('Singapore 639798'), 'SG');
  assert.equal(marketOf('Benguerir, Morocco (MA)'), 'EMEA');
  assert.equal(marketOf('Somewhere'), null);
});
