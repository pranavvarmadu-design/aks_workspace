// Her own account of her skills and constraints (pasted in the app).
// It overrides anything the resume implies.
const candidateBlock = (notes) => notes?.trim()
  ? `\n\nHer skills and constraints, in her own words. This is authoritative: where it says she prepares or interprets but does not operate an instrument, or does not have a technique, that is the truth regardless of how the resume reads.\n<candidate>\n${notes}\n</candidate>`
  : '';

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
      contact: obj({ name: str, title: str }),
      labResearch: obj({ focus: str, themes: arr(str), methods: arr(str) }),
      fitToLab: arr(obj({ labNeed: str, herEvidence: str })),
      screen: obj({
        sponsorship: { type: 'string', enum: ['offered', 'not_offered', 'not_stated', 'not_applicable'] },
        requiredSheLacks: arr(str),
        strengthsMatched: arr(str),
        coreOutput: str,
        verdict: { type: 'string', enum: ['apply', 'borderline', 'skip'] },
        reason: str,
      }),
    }),
    user: (job, candidate = '', labText = '') =>
      `Job listing:\n<job>\nTitle: ${job.title}\nEmployer: ${job.company}\nLocation: ${job.location}\nCategory: ${job.category || 'unknown'}\n\n${job.description || '(no description captured; work from the title and employer)'}\n</job>${labText?.trim() ? `\n\nAbout the lab or PI (their research page, summary or recent abstracts, as she pasted it):\n<lab>\n${labText}\n</lab>` : ''}\n\ndocumentStyle is academic_cv for university and research-institute roles, industry_resume otherwise. keywords are the exact terms an applicant tracking system or a search committee would look for. applicationNotes lists anything the listing asks applicants to submit or address (research statement, referees, visa status and so on), or an empty string.${candidateBlock(candidate)}

contact: the hiring PI or contact person named in the posting (or in the lab text) and their title; empty strings if none is named.
labResearch: what the lab or group actually researches, from the posting and the lab text only: focus (one sentence), themes (the research questions or systems), methods (the techniques the lab relies on).
fitToLab: each place where the lab's needs meet her real background. labNeed is what the lab needs or works on; herEvidence is the specific experience from her resume or candidate notes that answers it. Use only what her resume and notes actually say. Leave out needs she cannot answer; they belong in requiredSheLacks.

screen is a fast, honest go/no-go for her:
- sponsorship: for a US post, whether the listing offers visa sponsorship, rules it out (for example "must be authorized to work in the US without sponsorship"), or does not say. not_applicable outside the US. She has no work authorisation anywhere.
- requiredSheLacks: techniques the listing REQUIRES (not "preferred") that her candidate notes say she does not have, or only prepares for without operating. Empty if none or if there are no candidate notes.
- strengthsMatched: parts of the role that match what she is strong in.
- coreOutput: one phrase for what the lab mainly produces (for example sequence data, constructs, models, anatomical and imaging data, field data).
- For an industry post in India, also put in requiredSheLacks: a required degree or certification her resume does not show (for example B.Pharm, M.Pharm, MBA), a required minimum of years of industry, GMP or GLP experience (she may have none: check her notes), and a sales, marketing or business-development role presented under a scientific title.
- verdict: skip if any required technique is one she lacks, or sponsorship is not_offered for a US post, or (India industry) the role is sales or marketing, or it requires a degree she does not hold; borderline if the lab's core output is sequence data, constructs, proteins or models, or (India industry) it asks for several years of industry or GMP experience she lacks; apply if the work measures structures, secretions or organisms in the field or in collections and nothing required is missing.
- reason: one or two plain sentences.`,
  },

  // 3. Tailor: rewrite the master resume for this job without inventing anything.
  tailor: {
    system:
      `You tailor a resume to one job. The master resume is the only source of facts.

Rules that cannot be broken:
- Never add an employer, degree, date, publication, skill, tool, metric or achievement that is not in the master resume. Rewording and reordering are allowed; new facts are not.
- If the job asks for something the resume does not show, leave it out. Do not imply it.
- Keep every date, title and institution exactly as written.
- Never describe an instrument she prepares samples for as one she operates. Write "prepared samples for and interpreted", not "performed" or "ran", unless her notes say she operates it herself.
- Never claim a technique her notes list as one she does not have, even in passing.

What tailoring means here: aim the document at this PI's research. Lead with the experience listed in fitToLab, use the lab's own terms for its themes and methods where her work genuinely matches them, write the summary for this lab's research questions, then use the listing's own vocabulary where the resume describes the same thing in other words, cut or shorten what is irrelevant, and write a summary aimed at this role. For academic_cv keep publications, grants, teaching and awards complete and in standard CV order, with no length limit. For industry_resume aim for two pages, lead with outcomes, and put skills near the top.`,
    schema: obj({
      name: str,
      headline: str,
      contact: str,
      summary: str,
      sections: arr(obj({
        title: str,
        entries: arr(obj({ heading: str, subheading: str, dates: str, bullets: arr(str) })),
      })),
    }),
    user: (resume, job, analysis, opts) =>
      `Master resume:\n<resume>\n${resume}\n</resume>${candidateBlock(opts.candidate)}\n\nJob: ${job.title} at ${job.company} (${job.location})\n\nAnalysis of the listing:\n<analysis>\n${JSON.stringify(analysis, null, 2)}\n</analysis>\n${opts.notes ? `\nHer instructions for this application:\n${opts.notes}\n` : ''}\nProduce the tailored document in ${analysis.documentStyle} style. For list-like sections (skills, publications) use entries with an empty heading and the items as bullets.`,
  },

  // 4. Letter: cover letter to the PI and the short email that carries the package.
  letter: {
    system:
      `You write a cover letter and the short email that sends it, for one application. The master resume and her skills notes are the only source of facts about her.

Rules that cannot be broken:
- Never add an employer, degree, date, publication, skill, technique, metric or achievement that is not in the master resume or her notes.
- Never describe an instrument she prepares samples for as one she operates.
- Say something specific about the lab's research only if it is in the posting or the lab text; never invent a paper, project or result of theirs.

The letter is addressed to the named PI or contact if there is one (for example "Dear Professor Smith"), otherwise "Dear Hiring Committee". It runs 300 to 400 words in four or five paragraphs: the post and who she is in one or two sentences; why this lab, tied to its actual research themes; her matching experience, following fitToLab and naming concrete work; anything the role needs where she should be candid (for example the facility-operated instruments, using the wording in her notes), framed constructively; availability and thanks. If her notes say she needs visa sponsorship and the post is outside her country, include one plain sentence that she would need it, unless her instructions say otherwise. Plain, warm, specific prose; no clichés.

The email is the message she will send with the resume and letter attached: a subject line, and a body of three to five sentences that names the post, says what is attached and gives one line on her fit. Sign both with her name only; she adds her own contact details.`,
    schema: obj({
      emailSubject: str,
      emailBody: str,
      salutation: str,
      paragraphs: arr(str),
      closing: str,
      signature: str,
    }),
    user: (resume, job, analysis, tailored, candidate = '', notes = '') =>
      `Master resume:\n<resume>\n${resume}\n</resume>${candidateBlock(candidate)}\n\nJob: ${job.title} at ${job.company} (${job.location})\n<job>\n${(job.description || '').slice(0, 12000)}\n</job>\n\nAnalysis of the post, the lab and her fit:\n<analysis>\n${JSON.stringify(analysis, null, 2)}\n</analysis>\n\nThe tailored resume going with this letter:\n<tailored>\n${JSON.stringify(tailored)}\n</tailored>\n${notes ? `\nHer instructions for this application:\n${notes}\n` : ''}`,
  },

  // 5. Reviewer: independent check for invented claims and coverage gaps.
  reviewer: {
    system:
      'You audit a tailored resume against the master resume it was built from. Your job is to catch any claim in the tailored version that the master resume does not support, and to report how well the tailored version covers the job requirements. Be strict: a skill, number or responsibility that only appears in the tailored version is unsupported. So is any wording that says she operated an instrument or performed a technique where her candidate notes say she only prepared samples for it or does not have it.',
    schema: obj({
      matchScore: { type: 'integer' },
      unsupportedClaims: arr(obj({ claim: str, reason: str })),
      coveredRequirements: arr(str),
      gaps: arr(str),
      suggestions: arr(str),
    }),
    user: (resume, tailored, analysis, candidate = '', letter = null) =>
      `Master resume:\n<resume>\n${resume}\n</resume>${candidateBlock(candidate)}\n\nTailored version:\n<tailored>\n${JSON.stringify(tailored, null, 2)}\n</tailored>${letter ? `\n\nCover letter and email going with it (audit these claims too):\n<letter>\n${JSON.stringify(letter, null, 2)}\n</letter>` : ''}\n\nJob requirements:\n<analysis>\n${JSON.stringify(analysis, null, 2)}\n</analysis>\n\nmatchScore is 0-100 for how well her real background fits the must-have requirements. gaps are requirements she does not meet on paper. suggestions are things she could truthfully add if they apply to her (phrase each as a question to her).`,
  },
};
