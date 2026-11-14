// Shared defaults for the backend and the extension. Everything here can be
// overridden from the extension's Settings tab (and pushed to the backend).

export const MARKETS = {
  US: { label: 'United States', adzuna: ['us'] },
  SG: { label: 'Singapore', adzuna: ['sg'] },
  EMEA: { label: 'EMEA', adzuna: ['gb', 'de', 'nl', 'ch', 'fr'] },
};

export const SECTORS = {
  agritech: {
    label: 'Agritech',
    terms: ['agritech', 'agronomy', 'crop science', 'seed', 'precision agriculture', 'plant breeding', 'agri'],
  },
  biotech: {
    label: 'Biotech',
    terms: ['biotechnology', 'biotech', 'molecular biology', 'genomics', 'bioprocess', 'cell culture', 'fermentation'],
  },
  pharma: {
    label: 'Pharma',
    terms: ['pharmaceutical', 'pharma', 'drug discovery', 'formulation', 'clinical research', 'regulatory affairs', 'biologics'],
  },
};

export const DEFAULT_PROFILE = {
  // Field keywords drive every search. Replace them from her resume
  // (Settings -> "Extract keywords from resume").
  fieldKeywords: ['plant biotechnology', 'molecular biology', 'agriculture', 'biochemistry'],
  // Any-of role terms used for university searches.
  academicRoles: ['postdoctoral', 'research fellow', 'lecturer', 'assistant professor', 'research scientist', 'research associate'],
  // Up to three search phrases per India sector.
  sectorQueries: {
    agritech: ['agritech', 'agronomist', 'crop science'],
    biotech: ['biotechnology', 'molecular biology scientist', 'bioprocess'],
    pharma: ['pharmaceutical research', 'drug discovery', 'formulation scientist'],
  },
  excludeTerms: [],
};

export const DEFAULT_SOURCES = {
  adzuna: { enabled: true, maxDaysOld: 30, resultsPerPage: 50 },
  // HigherEdJobs publishes per-category RSS feeds: https://www.higheredjobs.com/rss/
  rss: [
    { name: 'HigherEdJobs: Plant and Soil Science', url: 'https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=49', market: 'US', university: true },
    { name: 'HigherEdJobs: Biology', url: 'https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=100', market: 'US', university: true },
    { name: 'HigherEdJobs: Biochemistry and Molecular Biology', url: 'https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=99', market: 'US', university: true },
    { name: 'HigherEdJobs: Pharmacy and Pharmacology', url: 'https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=154', market: 'US', university: true },
    { name: 'HigherEdJobs: Food Science', url: 'https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=53', market: 'US', university: true },
    { name: 'HigherEdJobs: Laboratory and Research', url: 'https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=150', market: 'US', university: true },
  ],
  // University career sites that run on Workday expose a JSON search endpoint.
  workday: [
    { name: 'NUS', host: 'nus.wd3.myworkdayjobs.com', tenant: 'nus', site: 'NUS', market: 'SG', university: true },
    { name: 'NTU Singapore', host: 'ntu.wd3.myworkdayjobs.com', tenant: 'ntu', site: 'Careers', market: 'SG', university: true },
  ],
  // Company career boards with public APIs. Add the board slug from the
  // company's careers URL, e.g. boards.greenhouse.io/<slug> or jobs.lever.co/<slug>.
  greenhouse: [], // { slug, name, market: 'IN', sector: 'biotech' }
  lever: [], // { slug, name, market: 'IN', sector: 'agritech' }
};

export const CATEGORY_LABELS = {
  university: 'Universities',
  industry: 'India industry',
};

export const UNIVERSITY_RE =
  /\b(universit\w*|college|institute of technology|polytechnic|hochschule|\beth\b|epfl|school of medicine|medical school|research institute|institut\w*|academy|a\*star|max planck|cnrs|inserm|csic|fraunhofer|helmholtz|wageningen|karolinska|nih\b|usda\b)/i;
