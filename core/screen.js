// Rule-based first pass over a listing's text: the "30-second screen".
// It flags; it never hides a listing. The analyst agent does the careful read.

// Techniques that, when REQUIRED, have repeatedly ruled her out.
export const DEFAULT_BLOCKERS = [
  'molecular cloning', 'cloning', 'vector design', 'protein expression', 'protein purification',
  'transcriptomic', 'rna-seq', 'qpcr', 'rt-qpcr', 'gene expression analysis', 'crispr',
  'qtl', 'gwas', 'quantitative genetics', 'genomic', 'ngs', 'bioinformatic', 'python', 'scripting',
  'geospatial', 'remote sensing', 'species distribution model', 'stable isotope', 'high-throughput screening',
  'mass spectrometry', 'lc-ms', 'gc-ms', 'mammalian cell culture', 'animal model', 'machine learning',
];

// Work where she is genuinely competitive.
export const DEFAULT_STRENGTHS = [
  'anatomy', 'histolog', 'ultrastructure', 'microscopy', 'imaging', 'morpholog', 'developmental biology',
  'floral', 'flower', 'pollinat', 'nectar', 'reproductive biology', 'herbarium', 'collections', 'phenology',
  'field work', 'fieldwork', 'field experiment', 'field trial', 'agronomy', 'plant physiology', 'sample preparation', 'extraction', 'teaching', 'plant structure',
];

const NO_SPONSOR = [
  /(not|unable to|cannot|can't|will not|won't|does not|do not)\s+(be\s+able\s+to\s+)?(provide|offer|support)?\s*(visa\s+)?sponsor/i,
  /no\s+(visa\s+)?sponsorship/i,
  /sponsorship\s+(is\s+)?not\s+(available|provided|offered)/i,
  /must\s+(be|have)\s+(legally\s+)?authori[sz]ed\s+to\s+work/i,
  /without\s+(the\s+need\s+for\s+)?(current\s+or\s+future\s+)?(visa\s+)?sponsorship/i,
  /u\.?s\.?\s+citizens?\s+(or|and)\s+(permanent\s+residents?|green\s+card)/i,
];
const YES_SPONSOR = [/(will|can|may)\s+(provide|offer|support)\s+(visa\s+)?sponsorship/i, /sponsorship\s+(is\s+)?available/i, /\bj-?1\b/i, /\bh-?1b\b/i, /international\s+applicants\s+(are\s+)?(welcome|encouraged)/i];

export function sponsorship(text = '') {
  if (NO_SPONSOR.some((r) => r.test(text))) return 'no';
  if (YES_SPONSOR.some((r) => r.test(text))) return 'yes';
  return null;
}

const INDIA_RE = /\b(india|delhi|ncr|gurgaon|gurugram|noida|faridabad|ghaziabad|mumbai|navi mumbai|thane|pune|bengaluru|bangalore|hyderabad|chennai|kolkata|ahmedabad|vadodara|baroda|chandigarh|lucknow|jaipur|indore|goa|sikkim|baddi|solan|visakhapatnam|vizag)\b/i;
const NCR_RE = /\b(delhi|ncr|gurgaon|gurugram|noida|faridabad|ghaziabad)\b/i;
const SALES_RE = /\b(sales|business development|marketing|territory|medical representative|area manager|key account|pre-?sales)\b/i;
const DEGREE_RE = /\b(b\.?\s?pharm|m\.?\s?pharm|pharm\.?\s?d|mba|pgdm|b\.?\s?tech|m\.?\s?tech|b\.?\s?e\.|chartered accountant)\b/gi;

export const isIndia = (job) => job.market === 'IN' || job.category === 'industry' || INDIA_RE.test(job.location || '');

// Smallest "N years" figure stated next to "experience", e.g. "3-5 years of experience" -> 3.
export function yearsRequired(text = '') {
  const found = [];
  const re = /(\d{1,2})\s*(?:\+|plus)?\s*(?:(?:-|to|–)\s*\d{1,2})?\s*(?:years?|yrs?)(?:'s)?\s*(?:of\s+)?(?:\w+\s+){0,4}?experience|experience[^.\d]{0,40}?(\d{1,2})\s*(?:\+|plus)?\s*(?:(?:-|to|–)\s*\d{1,2})?\s*\)?\s*(?:years?|yrs?)/gi;
  for (const m of text.matchAll(re)) found.push(Number(m[1] || m[2]));
  return found.length ? Math.min(...found) : null;
}

export function indiaChecks(job) {
  const text = `${job.title || ''}\n${job.description || ''}`;
  return {
    years: yearsRequired(text),
    industryExperience: /\b(industry|industrial|corporate|gmp|glp|manufacturing)\s+(?:\w+\s+){0,2}experience\b|experience\s+in\s+(?:a\s+|the\s+)?(?:pharmaceutical|agro|seed|biotech|fmcg)\s+(?:industry|company)/i.test(text),
    degrees: [...new Set([...text.matchAll(DEGREE_RE)].map((m) => m[0].replace(/\s+/g, '').toUpperCase().replace(/\.$/, '')))],
    sales: SALES_RE.test(job.title || ''),
    phd: /\bph\.?\s?d\b|doctorate/i.test(text),
    ncr: NCR_RE.test(job.location || ''),
  };
}

const has = (text, term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text);

export function screenJob(job, profile = {}) {
  const text = `${job.title || ''}\n${job.description || ''}`;
  const blockers = (profile.blockerTerms?.length ? profile.blockerTerms : DEFAULT_BLOCKERS).filter((t) => has(text, t));
  const strengths = (profile.strengthTerms?.length ? profile.strengthTerms : DEFAULT_STRENGTHS).filter((t) => has(text, t));
  return {
    hasText: (job.description || '').length > 200,
    sponsorship: !isIndia(job) && (job.market === 'US' || job.category === 'captured') ? sponsorship(text) : null,
    india: isIndia(job) ? indiaChecks(job) : null,
    blockers: [...new Set(blockers)].slice(0, 6),
    strengths: [...new Set(strengths)].slice(0, 6),
  };
}

// Visa label for a non-India post: 'yes' | 'no' | 'not_mentioned' (posting read, nothing said)
// | 'unchecked' (only a title is known, so it cannot be judged yet). null for India posts.
export function visaStatus(job) {
  if (isIndia(job)) return null;
  const s = sponsorship(`${job.title || ''}\n${job.description || ''}`);
  if (s) return s;
  return (job.description || '').length > 200 ? 'not_mentioned' : 'unchecked';
}

// 0-100 fit for her, used for ranking: field match, strengths, gaps, visa and India flags.
export function relevance(job, profile = {}, baseScore = 0) {
  const s = screenJob(job, profile);
  let r = baseScore;
  r += Math.min(4, s.strengths.length) * 8;
  r -= Math.min(3, s.blockers.length) * 25;
  const visa = visaStatus(job);
  if (visa === 'no') r -= 60;
  if (visa === 'yes') r += 10;
  if (s.india) {
    if (s.india.sales) r -= 60;
    if (s.india.degrees.length) r -= 20;
    if (s.india.years != null && s.india.years >= 3) r -= 10;
    if (s.india.industryExperience) r -= 10;
    if (s.india.phd) r += 10;
    if (s.india.ncr) r += 5;
  }
  // Three or more of her known gaps is normally a skip, however good the field match.
  if (s.blockers.length >= 3) r = Math.min(r, 15);
  return Math.max(0, Math.min(100, Math.round(r)));
}

export const relevanceLevel = (r) => (r >= 50 ? 'High' : r >= 20 ? 'Medium' : 'Low');
