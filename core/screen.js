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
  'field work', 'fieldwork', 'field experiment', 'sample preparation', 'extraction', 'teaching', 'plant structure',
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

const has = (text, term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text);

export function screenJob(job, profile = {}) {
  const text = `${job.title || ''}\n${job.description || ''}`;
  const blockers = (profile.blockerTerms?.length ? profile.blockerTerms : DEFAULT_BLOCKERS).filter((t) => has(text, t));
  const strengths = (profile.strengthTerms?.length ? profile.strengthTerms : DEFAULT_STRENGTHS).filter((t) => has(text, t));
  return {
    hasText: (job.description || '').length > 200,
    sponsorship: job.market === 'US' || job.category === 'captured' ? sponsorship(text) : null,
    blockers: [...new Set(blockers)].slice(0, 6),
    strengths: [...new Set(strengths)].slice(0, 6),
  };
}
