import { SOURCES } from './catalog.js';

export const AGE_GROUPS = [
  { id: 'infant', label: 'Under 1 year' },
  { id: 'preschool', label: '1–5 years' },
  { id: 'child', label: '6–8 years' },
  { id: 'preteen', label: '9–14 years' },
  { id: 'teen', label: '15–17 years' },
  { id: 'adult', label: '18–59 years' },
  { id: 'older60', label: '60–64 years' },
  { id: 'older65', label: '65–74 years' },
  { id: 'older75', label: '75+ years' },
];

export const PLANS = [
  {
    id: 'none',
    name: 'No country plan',
    shortName: 'Reference targets',
    source: SOURCES.schedules,
  },
  { id: 'finland', name: 'Finland', shortName: 'Finnish plan', source: SOURCES.finland },
  { id: 'germany', name: 'Germany', shortName: 'German plan', source: SOURCES.germany },
];

// These are course-count references, not universal medical recommendations.
// Each count names its assumption so users can choose their product's schedule.
const references = {
  chikungunya: [
    1,
    'One-dose product reference. Eligibility depends on age, health and product.',
    SOURCES.chikungunya,
  ],
  cholera: [2, 'Two-dose oral reference. Some products and young children use three doses.'],
  'covid-19': [
    1,
    'WHO simplified one-dose reference. Risk groups may need seasonal doses; this is not proof of immunity.',
    SOURCES.covid,
  ],
  dengue: [2, 'TAK-003 two-dose reference. Other products and eligibility differ.'],
  diphtheria: [
    3,
    'Three-dose primary-series reference; childhood and adult boosters are separate.',
  ],
  ebola: [
    1,
    'Ervebo one-dose reference. Other products can use two doses; vaccination is outbreak- and species-specific.',
    SOURCES.ebola,
  ],
  'hepatitis-a': [
    2,
    'Two-dose inactivated reference. Single-dose and combination-product schedules differ.',
  ],
  'hepatitis-b': [
    3,
    'Three-dose reference. Birth doses, combination products and accelerated schedules can change the total.',
  ],
  'hepatitis-e': [
    3,
    'Three-dose Hecolin reference; local availability and eligibility differ.',
    SOURCES.hepatitisE,
  ],
  hib: [3, 'Three-dose infant-course reference. Catch-up at older ages can need fewer doses.'],
  hpv: [
    2,
    'Two-dose reference when starting young. Later starts and immunocompromise can require three; WHO also supports certain one-dose programmes.',
  ],
  influenza: [
    1,
    'One adult seasonal dose; first vaccination before age nine usually needs two. Annual review remains necessary.',
  ],
  'japanese-encephalitis': [2, 'Two-dose inactivated reference. Live products can use one dose.'],
  malaria: [
    4,
    'Four-dose childhood reference in endemic areas. This is not a routine adult or travel vaccine.',
  ],
  measles: [
    2,
    'Two-dose primary-series reference. Early infant doses and adult catch-up need separate assessment.',
  ],
  'men-acwy': [
    1,
    'One-dose adolescent reference. Infant, risk-group and booster schedules differ.',
    SOURCES.germany,
  ],
  'men-b': [
    2,
    'Two-dose adolescent/adult reference. Infant schedules include a third dose.',
    SOURCES.germany,
  ],
  'men-c': [1, 'One-dose reference after infancy. Infant courses differ.'],
  mumps: [2, 'Two-dose MMR reference.'],
  pertussis: [
    3,
    'Three-dose primary-series reference. Later boosters and pregnancy recommendations are separate.',
  ],
  pneumococcal: [
    1,
    'One-dose adult conjugate reference. Infant courses usually contain three doses; prior products matter.',
    SOURCES.germany,
  ],
  polio: [3, 'Three-dose IPV primary-series reference. Oral, mixed and booster schedules differ.'],
  rabies: [
    2,
    'Two-dose PRE-exposure reference only. Animal exposure requires urgent medical care and a different assessment.',
  ],
  rsv: [
    1,
    'One-dose adult vaccination reference. Infant antibody prophylaxis is not a vaccine and must not be logged as one.',
    SOURCES.germany,
  ],
  rotavirus: [
    3,
    'Three-dose product reference; some products use two. Only for infants, with strict upper age limits.',
  ],
  rubella: [1, 'WHO one-dose reference; Finland and Germany use a two-dose MMR course.'],
  shingles: [
    2,
    'Two-dose recombinant reference. A past episode of shingles does not replace this series.',
    SOURCES.germany,
  ],
  'smallpox-mpox': [
    2,
    'Two-dose MVA-BN reference. Other products and previous smallpox vaccination can change the schedule.',
    SOURCES.mpox,
  ],
  tetanus: [
    3,
    'Three-dose primary-series reference. Boosters remain necessary; illness does not establish immunity.',
  ],
  tbe: [3, 'Three-dose primary-series reference. Later boosters depend on age and product.'],
  tuberculosis: [1, 'One-dose BCG reference for eligible children.'],
  typhoid: [1, 'One-dose injectable reference. Oral products need three or four doses.'],
  varicella: [
    2,
    'Two-dose course reference. Confirmed disease history can be accepted as evidence of protection.',
  ],
  'yellow-fever': [1, 'One-dose reference; eligibility and individual exceptions need assessment.'],
};

const childhoodCore = [
  'diphtheria',
  'tetanus',
  'pertussis',
  'polio',
  'measles',
  'mumps',
  'rubella',
  'varicella',
];
const earlyChildhood = ['hib', 'pneumococcal'];
const adultFinland = [...childhoodCore];
const adultGermany = ['diphtheria', 'tetanus', 'pertussis', 'polio', 'measles'];
const childGroups = ['infant', 'preschool', 'child', 'preteen', 'teen'];

/** Broad life-stage checklists include course completion, not just doses due today. */
export function includedDiseases(plan, ageGroup) {
  if (plan === 'none') return null;
  const child = childGroups.includes(ageGroup);
  const included = new Set(
    child ? childhoodCore : plan === 'finland' ? adultFinland : adultGermany,
  );
  if (['infant', 'preschool'].includes(ageGroup)) earlyChildhood.forEach((id) => included.add(id));
  if (ageGroup === 'infant') included.add('rotavirus');
  if (['preteen', 'teen'].includes(ageGroup)) included.add('hpv');

  if (plan === 'finland') {
    if (['infant', 'preschool', 'child', 'older65', 'older75'].includes(ageGroup))
      included.add('influenza');
    // THL's overview describes older-adult COVID vaccination without a universal cutoff.
    // In the older groups it is flagged for eligibility review, rather than prescribed.
    if (['older65', 'older75'].includes(ageGroup)) included.add('covid-19');
  }
  if (plan === 'germany') {
    if (child) included.add('hepatitis-b');
    if (['infant', 'preschool'].includes(ageGroup)) included.add('men-b');
    if (['preteen', 'teen'].includes(ageGroup)) included.add('men-acwy');
    if (['older60', 'older65', 'older75'].includes(ageGroup)) {
      ['influenza', 'pneumococcal', 'shingles'].forEach((id) => included.add(id));
    }
    // July 2026 RKI supersedes the older BMG overview: routine COVID from 75.
    if (ageGroup === 'older75') ['rsv', 'covid-19'].forEach((id) => included.add(id));
  }
  return included;
}

export function referenceFor(id, settings) {
  const [baseTarget, note, source = SOURCES.table] = references[id];
  const { plan, ageGroup } = settings;
  let target = baseTarget;
  if (id === 'rubella' && plan !== 'none') target = 2;
  if (['infant', 'preschool'].includes(ageGroup) && ['pneumococcal', 'men-b'].includes(id))
    target = 3;
  if (['infant', 'preschool', 'child'].includes(ageGroup) && id === 'influenza') target = 2;
  return { target, note, source };
}

export function planNotes(plan, ageGroup) {
  const notes = [
    'This is a life-stage checklist, including upcoming childhood courses and doses scheduled later in that stage. It does not decide what is due today. Update the age group as you grow.',
    'Targets describe a reference course. Exact age, dose spacing, product, previous doses and risk may change your schedule. Use Edit plan for individual needs.',
  ];
  if (ageGroup === 'infant')
    notes.push(
      'MMR and varicella are shown for planning the upcoming course, not for vaccination before the recommended age. Rotavirus has strict infant age limits.',
    );
  if (plan === 'finland') {
    if (['infant', 'preschool', 'child'].includes(ageGroup))
      notes.push(
        'THL schedules rotavirus at 2, 3 and 5 months; DTaP-IPV-Hib and pneumococcal at 3, 5 and 12 months; and a DTaP-IPV booster at four years.',
      );
    notes.push(
      'THL includes MMR and varicella for adults without protection. dTap is given at 25 and during pregnancy; dT at 45 and 65, then every 10 years.',
    );
    if (['infant', 'preschool', 'child'].includes(ageGroup))
      notes.push(
        'Finnish influenza eligibility is from six months through six years. MMR starts at 12 months, varicella at 18 months; the second MMR/varicella dose is at six.',
      );
    if (['preteen', 'teen'].includes(ageGroup))
      notes.push(
        'Finland offers HPV at 10–12 and a dTap booster at 14–15. Missed doses need an individual catch-up plan.',
      );
  }
  if (plan === 'germany') {
    notes.push(
      'Adult dT boosters are every 10 years, with pertussis at the next suitable booster. Adult measles catch-up applies to those born after 1970; the target here counts the full recorded course.',
    );
    if (ageGroup === 'infant')
      notes.push(
        'Infant RSV prevention is antibody prophylaxis, so it is not included as a vaccination in this tracker.',
      );
    if (['preteen', 'teen'].includes(ageGroup))
      notes.push(
        'HPV is offered at 9–14 with catch-up through 17; later starts can need three doses. MenACWY is offered in adolescence.',
      );
    notes.push(
      'The July 2026 RKI update replaces the general COVID three-contact rule with routine seasonal vaccination from 75 and risk-based recommendations below that age.',
    );
  }
  notes.push(
    'Travel, pregnancy, occupational and medical-risk recommendations are not inferred. Add those vaccines individually even when they are outside the country checklist.',
  );
  return notes;
}

export function ageLabel(id) {
  return AGE_GROUPS.find((group) => group.id === id)?.label || id;
}
