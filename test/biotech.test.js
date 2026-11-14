import test from 'node:test';
import assert from 'node:assert/strict';
import { isBiotechGenetics, relevance } from '../core/screen.js';

const base = { category: 'university', market: 'EMEA', company: 'University of Leeds', location: 'Leeds (GB)' };

test('biotechnology and genetics posts are labelled and ranked lower', () => {
  const genetics = { ...base, title: 'Postdoctoral Research Associate', description: 'Expertise in plant genetics is necessary.' };
  const biotech = { ...base, title: 'Research Fellow (Plant Biotechnology and Biochemistry)', description: '' };
  const anatomy = { ...base, title: 'Postdoctoral Research Associate', description: 'Floral anatomy and nectary development using microscopy.' };
  assert.ok(isBiotechGenetics(genetics) && isBiotechGenetics(biotech));
  assert.ok(!isBiotechGenetics(anatomy));
  assert.equal(relevance(genetics, {}, 30), relevance({ ...genetics, description: '' }, {}, 30) - 20);
});

test('India industry keeps its Biotech sector without the label', () => {
  assert.ok(!isBiotechGenetics({ category: 'industry', market: 'IN', sector: 'biotech', title: 'Plant Biotechnology Scientist', location: 'Pune' }));
});
