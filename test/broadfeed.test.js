import test from 'node:test';
import assert from 'node:assert/strict';
import { finalise } from '../core/collect.js';
import { DEFAULT_PROFILE } from '../core/config.js';

test('all-subject feeds keep only listings in her field or naming a core skill', () => {
  const j = (title, broadFeed) => ({ title, company: 'Harvard University', url: `https://x/${title}`, market: 'US', university: true, broadFeed });
  const kept = finalise([
    j('Staff Research Associate, Linguistics', true),
    j('Predoctoral Research Associate in Finance', true),
    j('Postdoctoral Fellow in Plant Biology', true),
    j('HMS - Postdoctoral Fellow in Cell Biology', true),
    j('Postdoctoral Associate', false),
  ], DEFAULT_PROFILE).map((x) => x.title);
  assert.deepEqual(kept.sort(), ['HMS - Postdoctoral Fellow in Cell Biology', 'Postdoctoral Associate', 'Postdoctoral Fellow in Plant Biology']);
});
