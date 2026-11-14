import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIndeedList, parseIndeedDetail, indeedSearches, indeedToRaw, resultText } from '../core/indeed.js';
import { finalise } from '../core/collect.js';
import { DEFAULT_PROFILE } from '../core/config.js';

// Trimmed from a real search_jobs answer.
const LIST = `**Job Title:** Postdoctoral Associate in Aquatic Plant Phytoremediation
            **Job Id:** JOBSEARCH_2
            **Company:** University of Maine
            **Location:** Orono, ME
            **Posted on:** November 09, 2026
            **Job Type:** Full-time
            **Compensation:** $50,000 - $55,000 a year
            **View Job URL:** https://to.indeed.com/aahsjsbd2mdz
            

**Job Title:** Microbiome Postdoctoral Fellow
            **Job Id:** JOBSEARCH_5
            **Company:** Lawrence Berkeley National Laboratory
            **Location:** San Francisco Bay Area, CA
            **Posted on:** November 11, 2026
            **Job Type:** Full-time
            **Compensation:** N/A
            **View Job URL:** https://to.indeed.com/aadnthg7nwdz
            

**Job Title:** Research Computational Biologist (Postdoctoral Research Associate)
            **Job Id:** JOBSEARCH_8
            **Company:** AGIL
            **Location:** Beltsville, MD
            **Posted on:** October 27, 2026
            **Job Type:** Full-time
            **Compensation:** $86,756 - $113,301 a year
            **View Job URL:** https://to.indeed.com/aamtlg8yqh6j
            `;
const DETAIL = `### Postdoctoral Associate in Aquatic Plant Phytoremediation
        **View Job URL:** https://to.indeed.com/aa2lks27f2l4
        **Job Id:** JOBSEARCH_2
        **Company:** University of Maine

        Coastal Maine Botanical Gardens invites applications.

Qualifications:
Ph.D. in Botany, Aquatic Ecology, Plant Biology.`;

test('parses Indeed search results and details', () => {
  const list = parseIndeedList(LIST);
  assert.equal(list.length, 3);
  assert.deepEqual(list[0], { jobId: 'JOBSEARCH_2', title: 'Postdoctoral Associate in Aquatic Plant Phytoremediation', company: 'University of Maine', location: 'Orono, ME', postedAt: 'November 09, 2026', jobType: 'Full-time', salary: '$50,000 - $55,000 a year', url: 'https://to.indeed.com/aahsjsbd2mdz' });
  assert.equal(list[1].salary, '');
  assert.match(parseIndeedDetail(DETAIL), /^Coastal Maine Botanical Gardens invites applications\.\s+Qualifications:\s+Ph\.D\. in Botany/);
  assert.equal(resultText({ payload: { result: 'x' } }), 'x');
  assert.equal(resultText({ content: [{ type: 'text', text: 'y' }] }), 'y');
});

test('Indeed listings go through the same filters', () => {
  const search = { market: 'US' };
  const jobs = finalise(parseIndeedList(LIST).map((j) => indeedToRaw(j, search)), DEFAULT_PROFILE);
  assert.deepEqual(jobs.map((j) => j.title).sort(), ['Microbiome Postdoctoral Fellow', 'Postdoctoral Associate in Aquatic Plant Phytoremediation']);
  assert.ok(jobs.every((j) => j.category === 'university' && j.source === 'Indeed' && j.id.startsWith('indeed:')));
  assert.equal(jobs[0].title, 'Postdoctoral Associate in Aquatic Plant Phytoremediation', 'plant title ranks first');
  const again = indeedToRaw({ ...parseIndeedList(LIST)[0], url: 'https://to.indeed.com/other' }, search);
  assert.equal(again.id, jobs[0].id, 'same posting keeps its id when Indeed changes the link');
});

test('searches cover US postdocs and India sectors', () => {
  const s = indeedSearches(DEFAULT_PROFILE);
  assert.ok(s.some((x) => x.country === 'US' && x.search === 'postdoctoral botany'));
  assert.ok(s.some((x) => x.country === 'IN' && x.location === 'India'));
  assert.ok(s.length <= 10);
});
