import test from 'node:test';
import assert from 'node:assert/strict';
import { coreSkillMatches, relevance, screenJob } from '../core/screen.js';
import { finalise } from '../core/collect.js';
import { DEFAULT_PROFILE } from '../core/config.js';

const base = { category: 'university', market: 'EMEA', company: 'University of Leeds', location: 'Leeds (GB)' };

test('core skills are found in titles and descriptions', () => {
  const names = (j) => coreSkillMatches(j).map((c) => c.name);
  assert.deepEqual(names({ title: 'Postdoc in Plant Cell Biology', description: 'TEM ultrastructure and confocal microscopy' }), ['Ultrastructure', 'Cell biology', 'Microscopy']);
  assert.deepEqual(names({ title: 'Research Associate', description: 'HPLC, GC-MS and ICP-MS profiling of metabolites in plant extracts' }), ['HPLC', 'ICP-MS', 'GC-MS', 'Metabolite profiling']);
  assert.deepEqual(names({ title: 'Postdoc in pollination ecology and biodiversity conservation' }), ['Pollination', 'Ecology', 'Biodiversity conservation']);
  assert.deepEqual(names({ title: 'Postdoc in floral development', description: 'phytochemistry of nectar' }), ['Developmental biology', 'Plant biochemistry']);
});

test('core-skill listings rank above plain plant listings', () => {
  const plain = relevance({ ...base, title: 'Postdoctoral Research Associate in Plant Science', description: 'Field trials of wheat.' }, {}, 30);
  const core = relevance({ ...base, title: 'Postdoctoral Research Associate in Plant Science', description: 'Nectary ultrastructure by electron microscopy and HPLC of nectar sugars.' }, {}, 30);
  const coreTitle = relevance({ ...base, title: 'Postdoc in Pollination Ecology', description: 'Nectary ultrastructure by electron microscopy.' }, {}, 30);
  assert.ok(core >= plain + 30, `${core} vs ${plain}`);
  assert.ok(coreTitle > core);
});

test('GC-MS and ICP-MS are no longer flagged as gaps; LC-MS still is', () => {
  assert.deepEqual(screenJob({ title: 'Postdoc', description: 'GC-MS and inductively coupled plasma mass spectrometry (ICP-MS)' }).blockers, []);
  assert.deepEqual(screenJob({ title: 'Postdoc', description: 'LC-MS/MS metabolomics' }).blockers, ['lc-ms']);
});

test('cell biology postdocs are no longer dropped', () => {
  const kept = finalise([{ ...base, university: true, title: 'Postdoctoral Research Associate in Plant Cell Biology', url: 'https://x/1' }], DEFAULT_PROFILE);
  assert.equal(kept.length, 1);
});
