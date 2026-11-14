import test from 'node:test';
import assert from 'node:assert/strict';
import { screenJob, sponsorship } from '../core/screen.js';

test('sponsorship language is classified', () => {
  assert.equal(sponsorship('Applicants must be authorized to work in the US without sponsorship.'), 'no');
  assert.equal(sponsorship('We are unable to provide visa sponsorship for this position.'), 'no');
  assert.equal(sponsorship('No visa sponsorship is available.'), 'no');
  assert.equal(sponsorship('This position is eligible for J-1 visa sponsorship.'), 'yes');
  assert.equal(sponsorship('International applicants are welcome to apply.'), 'yes');
  assert.equal(sponsorship('Postdoctoral fellow in floral anatomy.'), null);
});

test('screenJob flags blockers and strengths without hiding anything', () => {
  const s = screenJob({ market: 'US', title: 'Postdoc in floral anatomy', description: 'Required: molecular cloning and RNA-seq. Light microscopy of nectaries. ' + 'x'.repeat(200) });
  assert.ok(s.blockers.includes('molecular cloning') && s.blockers.includes('rna-seq'));
  assert.ok(s.strengths.includes('anatomy') && s.strengths.includes('microscopy') && s.strengths.includes('nectar'));
  assert.equal(s.hasText, true);
  assert.equal(screenJob({ market: 'IN', title: 'x', description: 'no sponsorship' }).sponsorship, null, 'sponsorship only judged for US or captured posts');
});
