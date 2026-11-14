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
  assert.deepEqual(names({ title: 'Postdoc: Bee Ecology And Conservation In Farmland' }), ['Ecology', 'Bee pollination']);
  assert.deepEqual(names({ title: 'Postdoc in plant-pollinator interactions', description: 'floral traits and nectar rewards; plant community ecology' }),
    ['Pollination', 'Ecology', 'Plant pollination', 'Floral ecology', 'Plant ecology']);
  assert.deepEqual(names({ title: 'Postdoc in floral development', description: 'phytochemistry of nectar' }), ['Developmental biology', 'Floral ecology', 'Plant biochemistry']);
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

test('a post that will not sponsor a visa stays at the bottom despite core skills', () => {
  const desc = 'Pollination ecology, floral microscopy and HPLC of nectar. ' + 'x '.repeat(120);
  const noVisa = relevance({ category: 'university', market: 'US', company: 'Iowa State University', location: 'Ames, IA', title: 'Postdoc in Pollination Ecology', description: desc + ' Sponsorship is not available.' }, {}, 40);
  const plain = relevance({ category: 'university', market: 'US', company: 'Iowa State University', location: 'Ames, IA', title: 'Postdoctoral Research Associate', description: 'Field trials. ' + 'x '.repeat(120) }, {}, 20);
  assert.ok(noVisa <= 10 && noVisa < plain, `${noVisa} vs ${plain}`);
});

test('specific pollination and floral ecology outrank broad ecology', () => {
  const b = { category: 'university', market: 'US', company: 'Iowa State University', location: 'Ames, IA', description: '' };
  const broad = relevance({ ...b, title: 'Postdoctoral Fellow, Ecosystem Ecology and Global Change' }, {}, 30);
  const bees = relevance({ ...b, title: 'Postdoc Research Associate - Bee Pollination Ecology' }, {}, 30);
  assert.ok(bees > broad, `${bees} vs ${broad}`);
});
