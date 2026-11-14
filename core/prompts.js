// Prompts and JSON schemas for the four resume agents. Each agent is one
// Claude call with a structured (JSON schema) response.

const str = { type: 'string' };
const arr = (items) => ({ type: 'array', items });
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

export const AGENTS = {
  // 1. Reads the master resume once and proposes search keywords.
  profile: {
    system:
      'You read a resume and produce search inputs for a job finder that covers (a) university and research-institute roles in the US, Singapore and EMEA, and (b) industry roles in India in agritech, biotech and pharma. Base everything strictly on the resume. Keywords must be short phrases a recruiter would put in a job title or description.',
    schema: obj({
      fieldKeywords: arr(str),
      academicRoles: arr(str),
      sectorQueries: obj({ agritech: arr(str), biotech: arr(str), pharma: arr(str) }),
      skills: arr(str),
      seniority: str,
    }),
    user: (resume) =>
      `Resume:\n<resume>\n${resume}\n</resume>\n\nReturn: fieldKeywords (4 research/field phrases, most specific first), academicRoles (4-6 postdoctoral role titles, e.g. postdoctoral fellow, postdoctoral research associate), sectorQueries (up to 3 job-search phrases per India sector that fit her background; leave a sector empty if nothing fits), skills (up to 15 techniques, tools and domains for relevance scoring), seniority (one line).`,
  },

  // 2. Job analyst: what does this listing actually ask for?
  analyst: {
    system:
      'You are a hiring analyst. Extract what a job listing requires so a resume can be tailored to it. Use only what the listing says; do not guess requirements it does not state.',
    schema: obj({
      roleSummary: str,
      documentStyle: { type: 'string', enum: ['academic_cv', 'industry_resume'] },
      mustHave: arr(str),
      niceToHave: arr(str),
      keywords: arr(str),
      responsibilities: arr(str),
      applicationNotes: str,
    }),
    user: (job) =>
      `Job listing:\n<job>\nTitle: ${job.title}\nEmployer: ${job.company}\nLocation: ${job.location}\nCategory: ${job.category || 'unknown'}\n\n${job.description || '(no description captured; work from the title and employer)'}\n</job>\n\ndocumentStyle is academic_cv for university and research-institute roles, industry_resume otherwise. keywords are the exact terms an applicant tracking system or a search committee would look for. applicationNotes lists anything the listing asks applicants to submit or address (research statement, referees, visa status and so on), or an empty string.`,
  },

  // 3. Tailor: rewrite the master resume for this job without inventing anything.
  tailor: {
    system:
      `You tailor a resume to one job. The master resume is the only source of facts.

Rules that cannot be broken:
- Never add an employer, degree, date, publication, skill, tool, metric or achievement that is not in the master resume. Rewording and reordering are allowed; new facts are not.
- If the job asks for something the resume does not show, leave it out. Do not imply it.
- Keep every date, title and institution exactly as written.

What tailoring means here: lead with the experience that matters most for this job, use the listing's own vocabulary where the resume describes the same thing in other words, cut or shorten what is irrelevant, and write a summary aimed at this role. For academic_cv keep publications, grants, teaching and awards complete and in standard CV order, with no length limit. For industry_resume aim for two pages, lead with outcomes, and put skills near the top.`,
    schema: obj({
      name: str,
      headline: str,
      contact: str,
      summary: str,
      sections: arr(obj({
        title: str,
        entries: arr(obj({ heading: str, subheading: str, dates: str, bullets: arr(str) })),
      })),
      coverLetter: str,
    }),
    user: (resume, job, analysis, opts) =>
      `Master resume:\n<resume>\n${resume}\n</resume>\n\nJob: ${job.title} at ${job.company} (${job.location})\n\nAnalysis of the listing:\n<analysis>\n${JSON.stringify(analysis, null, 2)}\n</analysis>\n${opts.notes ? `\nHer instructions for this application:\n${opts.notes}\n` : ''}\nProduce the tailored document in ${analysis.documentStyle} style. For list-like sections (skills, publications) use entries with an empty heading and the items as bullets. ${opts.coverLetter ? 'Also write coverLetter: a letter of at most 350 words addressed to the employer, using only facts from the resume, in plain paragraphs.' : 'Set coverLetter to an empty string.'}`,
  },

  // 4. Reviewer: independent check for invented claims and coverage gaps.
  reviewer: {
    system:
      'You audit a tailored resume against the master resume it was built from. Your job is to catch any claim in the tailored version that the master resume does not support, and to report how well the tailored version covers the job requirements. Be strict: a skill, number or responsibility that only appears in the tailored version is unsupported.',
    schema: obj({
      matchScore: { type: 'integer' },
      unsupportedClaims: arr(obj({ claim: str, reason: str })),
      coveredRequirements: arr(str),
      gaps: arr(str),
      suggestions: arr(str),
    }),
    user: (resume, tailored, analysis) =>
      `Master resume:\n<resume>\n${resume}\n</resume>\n\nTailored version:\n<tailored>\n${JSON.stringify(tailored, null, 2)}\n</tailored>\n\nJob requirements:\n<analysis>\n${JSON.stringify(analysis, null, 2)}\n</analysis>\n\nmatchScore is 0-100 for how well her real background fits the must-have requirements. gaps are requirements she does not meet on paper. suggestions are things she could truthfully add if they apply to her (phrase each as a question to her).`,
  },
};
