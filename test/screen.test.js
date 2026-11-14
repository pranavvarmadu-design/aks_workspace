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

test('India industry checks: experience, degrees, sales roles, location', async () => {
  const { indiaChecks, yearsRequired, isIndia } = await import('../core/screen.js');
  assert.equal(yearsRequired('Minimum 3-5 years of relevant industry experience'), 3);
  assert.equal(yearsRequired('Experience: 2+ yrs in QC'), 2);
  assert.equal(yearsRequired('PhD in Botany with publications'), null);
  const c = indiaChecks({ title: 'Research Scientist - Phytochemistry', location: 'Gurugram', description: 'M.Pharm or PhD. 4+ years of GMP experience in a pharmaceutical company.' });
  assert.equal(c.years, 4);
  assert.equal(c.industryExperience, true);
  assert.deepEqual(c.degrees, ['M.PHARM']);
  assert.equal(c.phd, true);
  assert.equal(c.ncr, true);
  assert.equal(c.sales, false);
  assert.equal(indiaChecks({ title: 'Area Sales Manager - Seeds', location: 'Pune' }).sales, true);
  assert.equal(isIndia({ category: 'captured', location: 'Hyderabad, Telangana' }), true);
  assert.equal(isIndia({ category: 'captured', location: 'Boston, MA' }), false);
  const s = screenJob({ category: 'captured', location: 'Pune, IN', title: 'x', description: 'must be authorized to work in the US without sponsorship' });
  assert.equal(s.sponsorship, null, 'sponsorship is not judged for India posts');
  assert.ok(s.india);
});

test('India checks on wording from a real posting', async () => {
  const { indiaChecks } = await import('../core/screen.js');
  const c = indiaChecks({ title: 'Research Scientist Biology - Micro-plot Field Trials', location: 'Udaipur, India',
    description: 'Contribute to the delivery of development products on mid-term (>3 years). Education: PhD or MSc in Agriculture. Work Experience: Post academic industrial research experience (2-5 years) appreciated.' });
  assert.equal(c.years, 2);
  assert.equal(c.industryExperience, true);
  assert.equal(c.phd, true);
  assert.equal(indiaChecks({ title: 'x', description: 'Experience in plant anatomy and microscopy.' }).industryExperience, false, '"plant" is botany, not a manufacturing plant');
  assert.ok(screenJob({ market: 'IN', title: 'Field trials scientist', description: 'Conducting high quality field trials' }).strengths.includes('field trial'));
});
