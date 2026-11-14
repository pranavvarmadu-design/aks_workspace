import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJobsAcUk, dayMonthToIso, closingToIso } from '../core/collectors.js';
import { finalise } from '../core/collect.js';
import { DEFAULT_PROFILE } from '../core/config.js';

const result = (code, title, employer, location, dept = '', placed = '05 Nov', closes = '01 Dec') => `
<div class="j-search-result__result ie-border-left" data-advert-id="1">
  <div class="j-search-result__text">
    <a href="https://www.jobs.ac.uk/job/${code}/slug">
      ${title}
    </a>
    <div class="j-search-result__department">${dept}</div>
    <div class="j-search-result__employer"><b>${employer}</b></div>
    <div>Location:
      ${location}
    </div>
    <div class="j-search-result__info"><strong>Salary: </strong> £39,000 to £46,500 </div>
    <div><strong>Date Placed: </strong>${placed}</div>
  </div>
  <div class="j-search-result__date-logos"><div class="j-search-result__date">
    <span class="j-search-result__date-span j-search-result__date">Closes</span>
    <span class="j-search-result__date-span j-search-result__date--blue ">${closes}</span>
  </div></div>
</div>`;

const html = '<html>' + [
  result('DTN868', 'Postdoctoral Researcher', 'John Innes Centre, Norwich', 'Norwich'),
  result('DTL551', 'Postdoctoral Research Associate', 'University of Oxford', 'Oxford', '', '29 Oct', '24 Nov'),
  result('DTJ486', 'PhD Studentship: Manipulating Meiotic Crossover Control in Wheat', 'University of East Anglia', 'Norwich', 'John Innes Centre'),
].join('') + '</html>';

test('jobs.ac.uk search results parse', () => {
  const today = new Date('2026-11-14T00:00:00Z');
  const jobs = parseJobsAcUk(html, today);
  assert.equal(jobs.length, 3);
  assert.deepEqual(
    { id: jobs[0].id, title: jobs[0].title, company: jobs[0].company, location: jobs[0].location, url: jobs[0].url, postedAt: jobs[0].postedAt, closes: jobs[0].closes },
    { id: 'jacDTN868', title: 'Postdoctoral Researcher', company: 'John Innes Centre, Norwich', location: 'Norwich', url: 'https://www.jobs.ac.uk/job/DTN868', postedAt: '2026-11-05', closes: '2026-12-01' },
  );
  assert.equal(dayMonthToIso('20 Dec', today), '2025-12-20', 'a posting date in the future is last year');
  assert.equal(closingToIso('15 Mar', today), '2027-03-15', 'a closing date already past is next year');
  assert.equal(closingToIso('24 Nov', today), '2026-11-24');
});

test('jobs.ac.uk listings keep postdocs at institutes and drop studentships', () => {
  const raw = parseJobsAcUk(html, new Date('2026-11-14T00:00:00Z')).map((j) => ({ ...j, market: 'EMEA', university: true }));
  const titles = finalise(raw, DEFAULT_PROFILE).map((j) => `${j.title} @ ${j.company}`);
  assert.ok(titles.includes('Postdoctoral Researcher @ John Innes Centre, Norwich'));
  assert.ok(titles.includes('Postdoctoral Research Associate @ University of Oxford'));
  assert.ok(!titles.some((t) => /Studentship/.test(t)));
});

test('UK plant institutes count as academic employers', async () => {
  const { classify } = await import('../core/collect.js');
  for (const company of ['John Innes Centre', 'Rothamsted Research', 'Royal Botanic Gardens, Kew', 'Earlham Institute'])
    assert.equal(classify({ company, market: 'EMEA', title: 'Postdoctoral Scientist' })?.category, 'university', company);
});
