// Leading plant-science universities and research institutes worldwide: the 150 places
// whose own career sites the "Search top universities" sweep reads.
//
// rank: position in the QS World University Rankings by Subject 2026, Agriculture & Forestry
//       (the 30 places QS shows publicly; read from topuniversities.com on 14 November 2026).
// The rest (rank: null) are curated, not ranked: chosen for plant biology, botany, plant
// anatomy and development, reproductive biology and pollination, and herbarium and
// collections work, with the research institutes and botanic gardens that hire postdocs.
// market: the app's university filters (US, SG, EMEA, OTHER).
// kind: university | institute | garden (botanic garden, herbarium or natural history museum).

const U = (name, country, market, domain, kind = 'university', rank = null) => ({ name, country, market, domain, kind, rank });

export const PLANT_SCIENCE_150 = [
  // ---- QS Agriculture & Forestry 2026, top 30 ----
  U('Wageningen University & Research', 'Netherlands', 'EMEA', 'wur.nl', 'university', 1),
  U('University of California, Davis', 'United States', 'US', 'ucdavis.edu', 'university', 2),
  U('Swedish University of Agricultural Sciences', 'Sweden', 'EMEA', 'slu.se', 'university', 3),
  U('Cornell University', 'United States', 'US', 'cornell.edu', 'university', 4),
  U('China Agricultural University', 'China', 'OTHER', 'cau.edu.cn', 'university', 5),
  U('Purdue University', 'United States', 'US', 'purdue.edu', 'university', 6),
  U('Iowa State University', 'United States', 'US', 'iastate.edu', 'university', 7),
  U('ETH Zurich', 'Switzerland', 'EMEA', 'ethz.ch', 'university', 8),
  U('Ghent University', 'Belgium', 'EMEA', 'ugent.be', 'university', 9),
  U('Norwegian University of Life Sciences', 'Norway', 'EMEA', 'nmbu.no', 'university', 10),
  U('Texas A&M University', 'United States', 'US', 'tamu.edu', 'university', 11),
  U('Michigan State University', 'United States', 'US', 'msu.edu', 'university', 12),
  U('University of Florida', 'United States', 'US', 'ufl.edu', 'university', 13),
  U('University of British Columbia', 'Canada', 'OTHER', 'ubc.ca', 'university', 14),
  U('University of Guelph', 'Canada', 'OTHER', 'uoguelph.ca', 'university', 14),
  U('University of California, Berkeley', 'United States', 'US', 'berkeley.edu', 'university', 16),
  U('University of Hohenheim', 'Germany', 'EMEA', 'uni-hohenheim.de', 'university', 17),
  U("L'Institut Agro", 'France', 'EMEA', 'institut-agro.fr', 'university', 18),
  U('University of Reading', 'United Kingdom', 'EMEA', 'reading.ac.uk', 'university', 19),
  U('Nanjing Agricultural University', 'China', 'OTHER', 'njau.edu.cn', 'university', 20),
  U('University of Göttingen', 'Germany', 'EMEA', 'uni-goettingen.de', 'university', 21),
  U('University of Illinois Urbana-Champaign', 'United States', 'US', 'illinois.edu', 'university', 22),
  U('University of Wisconsin-Madison', 'United States', 'US', 'wisc.edu', 'university', 22),
  U('University of Copenhagen', 'Denmark', 'EMEA', 'ku.dk', 'university', 24),
  U('North Carolina State University', 'United States', 'US', 'ncsu.edu', 'university', 25),
  U('The University of Queensland', 'Australia', 'OTHER', 'uq.edu.au', 'university', 26),
  U('University of Minnesota', 'United States', 'US', 'umn.edu', 'university', 27),
  U('South China Agricultural University', 'China', 'OTHER', 'scau.edu.cn', 'university', 28),
  U('The Ohio State University', 'United States', 'US', 'osu.edu', 'university', 29),
  U('Oregon State University', 'United States', 'US', 'oregonstate.edu', 'university', 30),

  // ---- United States: universities ----
  U('Washington State University', 'United States', 'US', 'wsu.edu'),
  U('University of California, Riverside', 'United States', 'US', 'ucr.edu'),
  U('Penn State University', 'United States', 'US', 'psu.edu'),
  U('Rutgers University', 'United States', 'US', 'rutgers.edu'),
  U('University of Georgia', 'United States', 'US', 'uga.edu'),
  U('Kansas State University', 'United States', 'US', 'k-state.edu'),
  U('University of Nebraska-Lincoln', 'United States', 'US', 'unl.edu'),
  U('Colorado State University', 'United States', 'US', 'colostate.edu'),
  U('University of Arizona', 'United States', 'US', 'arizona.edu'),
  U('Virginia Tech', 'United States', 'US', 'vt.edu'),
  U('University of Missouri', 'United States', 'US', 'missouri.edu'),
  U('Duke University', 'United States', 'US', 'duke.edu'),
  U('Stanford University', 'United States', 'US', 'stanford.edu'),
  U('Harvard University (incl. Arnold Arboretum)', 'United States', 'US', 'harvard.edu'),
  U('Yale University', 'United States', 'US', 'yale.edu'),
  U('Washington University in St. Louis', 'United States', 'US', 'wustl.edu'),
  U('University of Kentucky', 'United States', 'US', 'uky.edu'),
  U('University of Tennessee, Knoxville', 'United States', 'US', 'utk.edu'),
  U('University of Delaware', 'United States', 'US', 'udel.edu'),
  U('Utah State University', 'United States', 'US', 'usu.edu'),
  U('University of Massachusetts Amherst', 'United States', 'US', 'umass.edu'),
  U('The University of Texas at Austin', 'United States', 'US', 'utexas.edu'),
  U('Princeton University', 'United States', 'US', 'princeton.edu'),
  U('Columbia University', 'United States', 'US', 'columbia.edu'),
  U('University of Pennsylvania', 'United States', 'US', 'upenn.edu'),
  U('Brown University', 'United States', 'US', 'brown.edu'),
  U('Dartmouth College', 'United States', 'US', 'dartmouth.edu'),
  U('University of Chicago', 'United States', 'US', 'uchicago.edu'),
  U('California Institute of Technology', 'United States', 'US', 'caltech.edu'),
  U('University of California, San Diego', 'United States', 'US', 'ucsd.edu'),
  U('University of California, Los Angeles', 'United States', 'US', 'ucla.edu'),
  U('University of California, Santa Cruz', 'United States', 'US', 'ucsc.edu'),
  U('University of Connecticut', 'United States', 'US', 'uconn.edu'),
  U('New York University', 'United States', 'US', 'nyu.edu'),
  U('Stony Brook University', 'United States', 'US', 'stonybrook.edu'),

  // ---- United States: institutes, gardens and federal labs ----
  U('Donald Danforth Plant Science Center', 'United States', 'US', 'danforthcenter.org', 'institute'),
  U('Boyce Thompson Institute', 'United States', 'US', 'btiscience.org', 'institute'),
  U('Carnegie Science (Plant Biology)', 'United States', 'US', 'carnegiescience.edu', 'institute'),
  U('Salk Institute (Plant Biology)', 'United States', 'US', 'salk.edu', 'institute'),
  U('USDA Agricultural Research Service', 'United States', 'US', 'usda.gov', 'institute'),
  U('Smithsonian Institution (NMNH Botany)', 'United States', 'US', 'si.edu', 'garden'),
  U('Missouri Botanical Garden', 'United States', 'US', 'missouribotanicalgarden.org', 'garden'),
  U('New York Botanical Garden', 'United States', 'US', 'nybg.org', 'garden'),
  U('Field Museum (Botany)', 'United States', 'US', 'fieldmuseum.org', 'garden'),
  U('Chicago Botanic Garden', 'United States', 'US', 'chicagobotanic.org', 'garden'),

  // ---- United Kingdom and Ireland ----
  U('University of Oxford', 'United Kingdom', 'EMEA', 'ox.ac.uk'),
  U('University of Cambridge (incl. Sainsbury Laboratory)', 'United Kingdom', 'EMEA', 'cam.ac.uk'),
  U('John Innes Centre', 'United Kingdom', 'EMEA', 'jic.ac.uk', 'institute'),
  U('The Sainsbury Laboratory, Norwich', 'United Kingdom', 'EMEA', 'tsl.ac.uk', 'institute'),
  U('Rothamsted Research', 'United Kingdom', 'EMEA', 'rothamsted.ac.uk', 'institute'),
  U('James Hutton Institute', 'United Kingdom', 'EMEA', 'hutton.ac.uk', 'institute'),
  U('Royal Botanic Gardens, Kew', 'United Kingdom', 'EMEA', 'kew.org', 'garden'),
  U('Royal Botanic Garden Edinburgh', 'United Kingdom', 'EMEA', 'rbge.org.uk', 'garden'),
  U('Natural History Museum, London', 'United Kingdom', 'EMEA', 'nhm.ac.uk', 'garden'),
  U('University of Edinburgh', 'United Kingdom', 'EMEA', 'ed.ac.uk'),
  U('University of Nottingham', 'United Kingdom', 'EMEA', 'nottingham.ac.uk'),
  U('University of Leeds', 'United Kingdom', 'EMEA', 'leeds.ac.uk'),
  U('University of Sheffield', 'United Kingdom', 'EMEA', 'sheffield.ac.uk'),
  U('University of Warwick', 'United Kingdom', 'EMEA', 'warwick.ac.uk'),
  U('Imperial College London', 'United Kingdom', 'EMEA', 'imperial.ac.uk'),
  U('University of Glasgow', 'United Kingdom', 'EMEA', 'gla.ac.uk'),
  U('Trinity College Dublin', 'Ireland', 'EMEA', 'tcd.ie'),
  U('University College Dublin', 'Ireland', 'EMEA', 'ucd.ie'),

  // ---- Germany ----
  U('LMU Munich', 'Germany', 'EMEA', 'lmu.de'),
  U('Technical University of Munich', 'Germany', 'EMEA', 'tum.de'),
  U('University of Bonn', 'Germany', 'EMEA', 'uni-bonn.de'),
  U('Heidelberg University', 'Germany', 'EMEA', 'uni-heidelberg.de'),
  U('University of Tübingen', 'Germany', 'EMEA', 'uni-tuebingen.de'),
  U('Max Planck Institute for Plant Breeding Research', 'Germany', 'EMEA', 'mpipz.mpg.de', 'institute'),
  U('Max Planck Institute of Molecular Plant Physiology', 'Germany', 'EMEA', 'mpimp-golm.mpg.de', 'institute'),
  U('Max Planck Institute for Chemical Ecology', 'Germany', 'EMEA', 'ice.mpg.de', 'institute'),
  U('IPK Gatersleben', 'Germany', 'EMEA', 'ipk-gatersleben.de', 'institute'),
  U('Leibniz Institute of Plant Biochemistry', 'Germany', 'EMEA', 'ipb-halle.de', 'institute'),
  U('Botanic Garden and Botanical Museum Berlin', 'Germany', 'EMEA', 'bgbm.org', 'garden'),

  // ---- Netherlands, Belgium, Switzerland ----
  U('Utrecht University', 'Netherlands', 'EMEA', 'uu.nl'),
  U('University of Amsterdam', 'Netherlands', 'EMEA', 'uva.nl'),
  U('Leiden University', 'Netherlands', 'EMEA', 'universiteitleiden.nl'),
  U('Naturalis Biodiversity Center', 'Netherlands', 'EMEA', 'naturalis.nl', 'garden'),
  U('KU Leuven', 'Belgium', 'EMEA', 'kuleuven.be'),
  U('VIB (Center for Plant Systems Biology)', 'Belgium', 'EMEA', 'vib.be', 'institute'),
  U('Meise Botanic Garden', 'Belgium', 'EMEA', 'meisebotanicgarden.be', 'garden'),
  U('University of Zurich', 'Switzerland', 'EMEA', 'uzh.ch'),
  U('University of Bern', 'Switzerland', 'EMEA', 'unibe.ch'),
  U('University of Geneva', 'Switzerland', 'EMEA', 'unige.ch'),
  U('University of Lausanne', 'Switzerland', 'EMEA', 'unil.ch'),
  U('University of Basel', 'Switzerland', 'EMEA', 'unibas.ch'),

  // ---- France, Spain, Italy ----
  U('INRAE', 'France', 'EMEA', 'inrae.fr', 'institute'),
  U('CNRS', 'France', 'EMEA', 'cnrs.fr', 'institute'),
  U('Sorbonne University', 'France', 'EMEA', 'sorbonne-universite.fr'),
  U('Université Paris-Saclay', 'France', 'EMEA', 'universite-paris-saclay.fr'),
  U('University of Montpellier', 'France', 'EMEA', 'umontpellier.fr'),
  U("Muséum national d'Histoire naturelle", 'France', 'EMEA', 'mnhn.fr', 'garden'),
  U('Spanish National Research Council (CSIC)', 'Spain', 'EMEA', 'csic.es', 'institute'),
  U('Centre for Research in Agricultural Genomics (CRAG)', 'Spain', 'EMEA', 'cragenomica.es', 'institute'),
  U('Universidad Politécnica de Madrid', 'Spain', 'EMEA', 'upm.es'),
  U('University of Padua', 'Italy', 'EMEA', 'unipd.it'),
  U('University of Milan', 'Italy', 'EMEA', 'unimi.it'),

  // ---- Nordics, Austria, Czech Republic, Israel ----
  U('Stockholm University', 'Sweden', 'EMEA', 'su.se'),
  U('Umeå University (Umeå Plant Science Centre)', 'Sweden', 'EMEA', 'umu.se'),
  U('Uppsala University', 'Sweden', 'EMEA', 'uu.se'),
  U('Lund University', 'Sweden', 'EMEA', 'lu.se'),
  U('University of Helsinki', 'Finland', 'EMEA', 'helsinki.fi'),
  U('Aarhus University', 'Denmark', 'EMEA', 'au.dk'),
  U('University of Vienna', 'Austria', 'EMEA', 'univie.ac.at'),
  U('BOKU University, Vienna', 'Austria', 'EMEA', 'boku.ac.at'),
  U('Gregor Mendel Institute', 'Austria', 'EMEA', 'gmi.oeaw.ac.at', 'institute'),
  U('Masaryk University', 'Czech Republic', 'EMEA', 'muni.cz'),
  U('Weizmann Institute of Science', 'Israel', 'EMEA', 'weizmann.ac.il', 'institute'),
  U('Hebrew University of Jerusalem', 'Israel', 'EMEA', 'huji.ac.il'),
  U('Tel Aviv University', 'Israel', 'EMEA', 'tau.ac.il'),

  // ---- Singapore ----
  U('National University of Singapore', 'Singapore', 'SG', 'nus.edu.sg'),
  U('Nanyang Technological University', 'Singapore', 'SG', 'ntu.edu.sg'),
  U('Temasek Life Sciences Laboratory', 'Singapore', 'SG', 'tll.org.sg', 'institute'),
  U('A*STAR', 'Singapore', 'SG', 'a-star.edu.sg', 'institute'),
  U('Singapore Botanic Gardens (NParks)', 'Singapore', 'SG', 'nparks.gov.sg', 'garden'),

  // ---- Asia ----
  U('The University of Tokyo', 'Japan', 'OTHER', 'u-tokyo.ac.jp'),
  U('Kyoto University', 'Japan', 'OTHER', 'kyoto-u.ac.jp'),
  U('Nagoya University', 'Japan', 'OTHER', 'nagoya-u.ac.jp'),
  U('RIKEN Center for Sustainable Resource Science', 'Japan', 'OTHER', 'riken.jp', 'institute'),
  U('The University of Hong Kong', 'Hong Kong', 'OTHER', 'hku.hk'),
  U('Academia Sinica', 'Taiwan', 'OTHER', 'sinica.edu.tw', 'institute'),

  // ---- Australia, Canada, South Africa, Brazil ----
  U('Australian National University', 'Australia', 'OTHER', 'anu.edu.au'),
  U('The University of Melbourne', 'Australia', 'OTHER', 'unimelb.edu.au'),
  U('The University of Western Australia', 'Australia', 'OTHER', 'uwa.edu.au'),
  U('The University of Adelaide', 'Australia', 'OTHER', 'adelaide.edu.au'),
  U('The University of Sydney', 'Australia', 'OTHER', 'sydney.edu.au'),
  U('CSIRO', 'Australia', 'OTHER', 'csiro.au', 'institute'),
  U('University of Toronto', 'Canada', 'OTHER', 'utoronto.ca'),
  U('University of Saskatchewan', 'Canada', 'OTHER', 'usask.ca'),
  U('McGill University', 'Canada', 'OTHER', 'mcgill.ca'),
  U('Stellenbosch University', 'South Africa', 'EMEA', 'sun.ac.za'),
  U('University of Cape Town', 'South Africa', 'EMEA', 'uct.ac.za'),
  U('University of São Paulo', 'Brazil', 'OTHER', 'usp.br'),
];

// ---- The 70 universities the sweep checks, in priority order ----
// Tier 1: Oxford, Cambridge, the Ivy League and Ivy-adjacent US universities, UC Davis (a
//         contact there), and every university in California, New Jersey, New York and
//         Connecticut (where she would like to move).
// Tier 2: the other US and UK universities. Tier 3: Europe, Singapore and the rest.
// No Chinese universities. Institutes and botanic gardens stay in PLANT_SCIENCE_150 but are not swept.
export const TIER_1_DOMAINS = [
  'ox.ac.uk', 'cam.ac.uk',
  'harvard.edu', 'yale.edu', 'princeton.edu', 'columbia.edu', 'upenn.edu', 'brown.edu', 'dartmouth.edu', 'cornell.edu',
  'stanford.edu', 'uchicago.edu', 'caltech.edu', 'duke.edu', 'berkeley.edu', 'wustl.edu',
  // UC Davis and the states she would like to move to
  'ucdavis.edu', 'ucr.edu', 'ucsd.edu', 'ucla.edu', 'ucsc.edu', // California
  'rutgers.edu', // New Jersey (Princeton above)
  'nyu.edu', 'stonybrook.edu', // New York (Cornell and Columbia above)
  'uconn.edu', // Connecticut (Yale above)
];
const EXCLUDED_COUNTRIES = new Set(['China']);
const MORE = [
  // United States
  'wsu.edu', 'ucr.edu', 'psu.edu', 'rutgers.edu', 'uga.edu', 'arizona.edu', 'colostate.edu', 'missouri.edu', 'unl.edu',
  // United Kingdom and Ireland
  'ed.ac.uk', 'nottingham.ac.uk', 'leeds.ac.uk', 'sheffield.ac.uk', 'warwick.ac.uk', 'imperial.ac.uk', 'tcd.ie',
  // Europe
  'lmu.de', 'tum.de', 'uni-bonn.de', 'uni-heidelberg.de', 'uni-tuebingen.de',
  // Dropped to make room for the new tier-1 places: uu.nl, kuleuven.be, uzh.ch, su.se, umu.se, uu.se.
  // Singapore
  'nus.edu.sg', 'ntu.edu.sg',
];
const byDomain = new Map(PLANT_SCIENCE_150.map((u) => [u.domain, u]));
const isUK = (u) => /united kingdom|ireland/i.test(u.country);
const tierOf = (u) => (TIER_1_DOMAINS.includes(u.domain) ? 1 : u.market === 'US' || isUK(u) ? 2 : 3);
const chosen = [...new Set([
  ...TIER_1_DOMAINS,
  ...PLANT_SCIENCE_150.filter((u) => u.rank && !EXCLUDED_COUNTRIES.has(u.country)).map((u) => u.domain),
  ...MORE,
])].map((d) => byDomain.get(d));
// Tier, then US before UK before the rest, then QS rank, then list order.
const regionOrder = (u) => (u.market === 'US' ? 0 : isUK(u) ? 1 : 2);
export const TOP_70 = chosen
  .map((u, i) => ({ ...u, tier: tierOf(u), i }))
  .sort((a, b) => a.tier - b.tier || regionOrder(a) - regionOrder(b) || (a.rank ?? 99) - (b.rank ?? 99) || a.i - b.i)
  .map(({ i, ...u }) => u);
