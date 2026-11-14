import test from 'node:test';
import assert from 'node:assert/strict';
import { TOP_70, TIER_1_DOMAINS } from '../core/universities.js';
import { relevance, isTier1Employer, isUKJob, isTopPriority } from '../core/screen.js';

test('the 70: no China, all tier-1 present and first, US then UK within tiers', () => {
  assert.equal(TOP_70.length, 70);
  assert.equal(new Set(TOP_70.map((u) => u.domain)).size, 70);
  assert.ok(!TOP_70.some((u) => u.country === 'China'));
  assert.deepEqual(TOP_70.slice(0, TIER_1_DOMAINS.length).map((u) => u.domain).sort(), [...TIER_1_DOMAINS].sort());
  const t1 = TOP_70.filter((u) => u.tier === 1);
  const lastUS = t1.map((u) => u.market).lastIndexOf('US');
  assert.ok(t1.slice(lastUS + 1).every((u) => u.country === 'United Kingdom'), 'Ivies before Oxbridge');
  for (const d of ['ucdavis.edu', 'berkeley.edu', 'ucsd.edu', 'rutgers.edu', 'nyu.edu', 'uconn.edu', 'yale.edu'])
    assert.equal(TOP_70.find((u) => u.domain === d)?.tier, 1, d);
  assert.equal(TOP_70[0].domain, 'ucdavis.edu', 'UC Davis first (highest QS rank in tier 1)');
  const tiers = TOP_70.map((u) => u.tier);
  assert.deepEqual(tiers, [...tiers].sort((a, b) => a - b), 'ordered by tier');
  assert.ok(TOP_70.filter((u) => u.tier === 2).every((u) => u.market === 'US' || /Kingdom|Ireland/.test(u.country)));
});

test('ranking prefers Oxbridge and Ivy employers, then US and UK roles', () => {
  const base = { title: 'Postdoctoral Research Associate in Plant Biology', description: '', category: 'university' };
  const oxford = relevance({ ...base, company: 'University of Oxford', location: 'Oxford, Oxfordshire', market: 'EMEA' }, {}, 30);
  const yale = relevance({ ...base, company: 'Yale University', location: 'New Haven, CT', market: 'US' }, {}, 30);
  const iowa = relevance({ ...base, company: 'Iowa State University', location: 'Ames, IA', market: 'US' }, {}, 30);
  const leeds = relevance({ ...base, company: 'University of Leeds', location: 'Leeds, West Yorkshire (GB)', market: 'EMEA' }, {}, 30);
  const zurich = relevance({ ...base, company: 'University of Zurich', location: 'Zurich (CH)', market: 'EMEA' }, {}, 30);
  assert.ok(oxford > leeds && yale > iowa, 'tier 1 above other US/UK');
  assert.ok(iowa > zurich && leeds > zurich, 'US and UK above the rest');
  assert.ok(isTier1Employer({ company: 'Harvard University' }) && !isTier1Employer({ company: 'University of Missouri' }));
  assert.ok(!isTier1Employer({ company: 'University of Missouri - Biochemistry', location: 'Columbia, Missouri' }), 'Columbia, MO is not Columbia University');
  assert.ok(isUKJob({ location: 'Oxford, Oxfordshire' }) && !isUKJob({ company: 'MIT', location: 'Cambridge, MA' }));
  assert.ok(isTier1Employer({ company: 'University of California, Davis' }) && isTier1Employer({ company: 'Rutgers University' }));
  const davis = relevance({ ...base, company: 'University of California, Davis', location: 'Davis, CA', market: 'US' }, {}, 30);
  assert.ok(davis > iowa, 'UC Davis above other US');
  assert.ok(isTopPriority({ company: 'Boyce Thompson Institute', location: 'Ithaca, NY', market: 'US' }), 'any post in NY');
  assert.ok(isTopPriority({ company: 'Salk Institute', location: 'La Jolla, California', market: 'US' }), 'any post in CA');
  assert.ok(!isTopPriority({ company: 'University of Toronto', location: 'Toronto, ON, CA', market: 'OTHER' }), 'Canada is not California');
  assert.ok(!isTopPriority({ company: 'Iowa State University', location: 'Ames, IA', market: 'US' }));
});
