// Shared defaults for the backend and the extension. Everything here can be
// overridden from the extension's Settings tab (and pushed to the backend).

export const MARKETS = {
  US: { label: 'United States', adzuna: ['us'] },
  SG: { label: 'Singapore', adzuna: ['sg'] },
  EMEA: { label: 'EMEA', adzuna: ['gb', 'de', 'nl', 'ch', 'fr'] },
  OTHER: { label: 'Other countries', adzuna: ['ca', 'au', 'nz'] },
};

export const SECTORS = {
  agritech: {
    label: 'Agritech',
    terms: ['agritech', 'agronomy', 'agronomist', 'crop science', 'crop research', 'seed', 'precision agriculture', 'plant breeding', 'horticulture', 'pollination', 'agri'],
  },
  biotech: {
    label: 'Biotech',
    terms: ['biotechnology', 'biotech', 'molecular biology', 'genomics', 'bioprocess', 'cell culture', 'fermentation', 'tissue culture', 'botany', 'microscopy'],
  },
  pharma: {
    label: 'Pharma',
    terms: ['pharmaceutical', 'pharma', 'drug discovery', 'formulation', 'clinical research', 'regulatory affairs', 'biologics', 'phytochem', 'herbal', 'ayurved', 'nutraceutical', 'botanical', 'cosmetic', 'analytical'],
  },
};

export const DEFAULT_PROFILE = {
  // Field keywords drive every search. Replace them from her resume
  // (Settings -> "Extract keywords from resume").
  fieldKeywords: ['plant anatomy', 'pollination biology', 'floral biology', 'plant reproductive biology'],
  // Any-of role terms used for university searches.
  academicRoles: ['postdoctoral', 'postdoc', 'postdoctoral fellow', 'postdoctoral research associate', 'postdoctoral scholar'],
  // Up to three search phrases per India sector.
  sectorQueries: {
    agritech: ['agronomist', 'crop research scientist', 'seed research'],
    biotech: ['plant tissue culture', 'research scientist botany', 'plant biotechnology'],
    pharma: ['phytochemistry', 'herbal research scientist', 'analytical research scientist'],
  },
  // Titles in fields far from plant biology. Matched at word starts, so 'neuro' also covers neuroscience.
  excludeTerms: [
    'marine', 'ocean', 'coastal', 'fisheries', 'neuro', 'brain', 'oncology', 'cancer', 'tumor', 'hematology',
    'pediatric', 'cardio', 'cardiac', 'vascular', 'immunolog', 'immune', 't cell', 'viral', 'virus', 'medicine',
    'medical', 'clinical', 'surgery', 'radiology', 'psych', 'pharmacy practice', 'diabetes', 't1d', 'cornea',
    'mathematical', 'computational', 'engineering', 'bioelectronic', 'ultrasound', 'quantum', 'artificial intelligence',
    'machine learning', 'drug delivery', 'tissue engineering', 'regeneration', 'enzyme kinetics', 'biophysics',
    'chemical biology', 'physics', 'mouse', 'zebrafish', 'mammal', 'veterinary', 'animal science',
    'pharmacolog', 'pharmaceutic', 'medicinal chemistry', 'drug', 'cell biology', 'assay',
    'economic', 'aerosol', 'emission', 'methane',
    'deer', 'wildlife', 'geography',
  ],
  // Office and plant-floor roles skipped in the India industry tab.
  industryExcludeTerms: [
    'finance', 'account', 'audit', 'tax', 'legal', 'compliance officer', 'hr', 'human resource', 'talent', 'payroll',
    'procurement', 'purchase', 'supply chain', 'logistic', 'warehouse', 'sap', 'it ', 'software', 'developer', 'engineer',
    'architect', 'data platform', 'digital', 'cyber', 'security', 'mechanic', 'electrical', 'instrument', 'maintenance',
    'production', 'manufacturing', 'operator', 'technician', 'shift', 'driver', 'admin', 'secretary', 'crm', 'category manager',
  ],
  // Methods she does not have: skipped even when the title is in her field.
  alwaysExcludeTerms: ['model', 'remote sensing', 'forecasting', 'ai/ml', 'machine learning', 'data science', 'bioinformatic', 'computational'],
  // Words in a title that mark her field; they lift a listing up the ranking.
  relevanceTerms: [
    'plant', 'botan', 'crop', 'floral', 'flower', 'pollinat', 'nectar', 'horticult', 'agronom', 'seed', 'herbar',
    'phenolog', 'ecolog', 'evolution', 'systematic', 'phenomic', 'viticult', 'mycolog', 'soil', 'agricult', 'food',
    'horticult', 'forest', 'entomolog', 'insect', 'bee',
  ],
  // Keep only university listings whose title matches academicRoles (postdoc by default).
  universityRolesOnly: true,
};

export const DEFAULT_SOURCES = {
  adzuna: { enabled: true, maxDaysOld: 30, resultsPerPage: 50 },
  // HigherEdJobs publishes per-category RSS feeds: https://www.higheredjobs.com/rss/
  rss: [
    { name: 'HigherEdJobs: Plant and Soil Science', url: 'https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=49', market: 'US', university: true },
    { name: 'HigherEdJobs: Biology', url: 'https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=100', market: 'US', university: true },
    { name: 'HigherEdJobs: Horticulture', url: 'https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=123', market: 'US', university: true },
    { name: 'HigherEdJobs: Ecology, Environmental Science and Forestry', url: 'https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=54', market: 'US', university: true },
    { name: 'HigherEdJobs: Entomology', url: 'https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=52', market: 'US', university: true },
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
  // India industry: employers' own career sites. Add more with the same shapes.
  // SAP SuccessFactors career sites publish RSS search feeds with full descriptions.
  employerFeeds: [
    { name: 'Cipla', base: 'https://careers.cipla.com', sector: 'pharma' },
    { name: 'UPL', base: 'https://careers.upl-ltd.com', sector: 'agritech' },
    { name: 'Bayer', base: 'https://jobs.bayer.com' },
  ],
  employerKeywords: ['research', 'scientist', 'analytical', 'regulatory'],
  smartrecruiters: [{ company: 'SyngentaGroup', name: 'Syngenta', country: 'in', sector: 'agritech' }],
  workdayIndustry: [{ name: 'FMC', host: 'fmc.wd12.myworkdayjobs.com', tenant: 'fmc', site: 'FMC', sector: 'agritech' }],
  greenhouse: [], // { slug, name, market: 'IN', sector: 'biotech' }
  lever: [], // { slug, name, market: 'IN', sector: 'agritech' }
};

// Indeed postdoc searches for every country Indeed serves well, in each country's own job-title style.
// style: 'us' postdoctoral; 'fellow' research fellow / research associate; 'postdoc' postdoc.
export const INDEED_COUNTRIES = [
  { code: 'US', name: 'United States', market: 'US', style: 'us' },
  { code: 'CA', name: 'Canada', market: 'OTHER', style: 'us' },
  { code: 'GB', name: 'United Kingdom', market: 'EMEA', style: 'fellow' },
  { code: 'IE', name: 'Ireland', market: 'EMEA', style: 'fellow' },
  { code: 'DE', name: 'Germany', market: 'EMEA', style: 'postdoc' },
  { code: 'NL', name: 'Netherlands', market: 'EMEA', style: 'postdoc' },
  { code: 'CH', name: 'Switzerland', market: 'EMEA', style: 'postdoc' },
  { code: 'AT', name: 'Austria', market: 'EMEA', style: 'postdoc' },
  { code: 'BE', name: 'Belgium', market: 'EMEA', style: 'postdoc' },
  { code: 'FR', name: 'France', market: 'EMEA', style: 'postdoc' },
  { code: 'ES', name: 'Spain', market: 'EMEA', style: 'postdoc' },
  { code: 'IT', name: 'Italy', market: 'EMEA', style: 'postdoc' },
  { code: 'SE', name: 'Sweden', market: 'EMEA', style: 'postdoc' },
  { code: 'DK', name: 'Denmark', market: 'EMEA', style: 'postdoc' },
  { code: 'NO', name: 'Norway', market: 'EMEA', style: 'postdoc' },
  { code: 'FI', name: 'Finland', market: 'EMEA', style: 'postdoc' },
  { code: 'IL', name: 'Israel', market: 'EMEA', style: 'postdoc' },
  { code: 'AE', name: 'United Arab Emirates', market: 'EMEA', style: 'fellow' },
  { code: 'ZA', name: 'South Africa', market: 'EMEA', style: 'fellow' },
  { code: 'SG', name: 'Singapore', market: 'SG', style: 'fellow' },
  { code: 'HK', name: 'Hong Kong', market: 'OTHER', style: 'fellow' },
  { code: 'JP', name: 'Japan', market: 'OTHER', style: 'postdoc' },
  { code: 'AU', name: 'Australia', market: 'OTHER', style: 'fellow' },
  { code: 'NZ', name: 'New Zealand', market: 'OTHER', style: 'fellow' },
];

export const CATEGORY_LABELS = {
  university: 'Universities',
  industry: 'India industry',
};

export const UNIVERSITY_RE =
  /\b(universit\w*|universid\w*|national laborator\w*|botanic\w*|csiro|inrae|riken|college|institute of technology|polytechnic|hochschule|\beth\b|epfl|school of medicine|medical school|research institute|institut\w*|academy|a\*star|max planck|cnrs|inserm|csic|fraunhofer|helmholtz|wageningen|karolinska|nih\b|usda\b)/i;
