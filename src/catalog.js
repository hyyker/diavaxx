// The catalogue contains identities only. Schedule rules live in plans.js.
export const SOURCES = {
  who: 'https://www.who.int/teams/immunization-vaccines-and-biologicals/diseases',
  schedules:
    'https://www.who.int/teams/immunization-vaccines-and-biologicals/policies/who-recommendations-for-routine-immunization---summary-tables',
  table:
    'https://cdn.who.int/media/docs/default-source/immunization/immunization_schedules/immunization-summary-table-1.pdf',
  finland:
    'https://thl.fi/nakemyksemme/korkeasta-rokotuskattavuudesta-on-pidettava-huolta/kansallinen-rokotusohjelma-mita-rokotteita-eri-ikaisille-suositellaan-',
  germany:
    'https://www.bundesgesundheitsministerium.de/themen/praevention/impfungen/schutzimpfungen',
  germanCovid: 'https://edoc.rki.de/handle/176904/13784.2',
  covid: 'https://www.who.int/publications/m/item/who-policy-brief-covid-19-vaccination',
  chikungunya: 'https://www.ema.europa.eu/en/medicines/human/EPAR/ixchiq',
  ebola: 'https://www.who.int/news-room/questions-and-answers/item/ebola-vaccines',
  hepatitisE: 'https://www.who.int/news-room/fact-sheets/detail/hepatitis-E',
  mpox: 'https://www.who.int/news-room/questions-and-answers/item/mpox-vaccines',
};
export const SOURCE_REVIEW_DATE = '2026-09-08';

export const combinations = [
  {
    id: 'mmrv',
    name: 'MMRV · measles, mumps, rubella & varicella',
    ids: ['measles', 'mumps', 'rubella', 'varicella'],
  },
  {
    id: 'pentavalent',
    name: 'DTaP-IPV-Hib · five-in-one',
    ids: ['diphtheria', 'tetanus', 'pertussis', 'polio', 'hib'],
  },
  {
    id: 'hexavalent',
    name: 'DTaP-IPV-Hib-HepB · six-in-one',
    ids: ['diphtheria', 'tetanus', 'pertussis', 'polio', 'hib', 'hepatitis-b'],
  },
  { id: 'mmr', name: 'MMR · measles, mumps & rubella', ids: ['measles', 'mumps', 'rubella'] },
  { id: 'dt', name: 'dT · diphtheria & tetanus', ids: ['diphtheria', 'tetanus'] },
  {
    id: 'dtap',
    name: 'DTP / Tdap · diphtheria, tetanus & pertussis',
    ids: ['diphtheria', 'tetanus', 'pertussis'],
  },
  {
    id: 'dtap-ipv',
    name: 'DTP-IPV · DTP & polio',
    ids: ['diphtheria', 'tetanus', 'pertussis', 'polio'],
  },
  { id: 'hepa-b', name: 'Hepatitis A & B', ids: ['hepatitis-a', 'hepatitis-b'] },
];
// WHO “Available vaccines”, reviewed 2026-09-08. Grouped diseases are split
// for useful record keeping. Shingles is an additional entry from the reference app.
const rows = [
  ['chikungunya', 'Chikungunya', 'Travel & exposure'],
  ['cholera', 'Cholera', 'Travel & exposure'],
  ['covid-19', 'COVID-19', 'Respiratory', 'Coronavirus'],
  ['dengue', 'Dengue', 'Travel & exposure'],
  ['diphtheria', 'Diphtheria', 'Routine'],
  ['ebola', 'Ebola disease', 'Travel & exposure'],
  ['hepatitis-a', 'Hepatitis A', 'Hepatitis'],
  ['hepatitis-b', 'Hepatitis B', 'Hepatitis'],
  ['hepatitis-e', 'Hepatitis E', 'Hepatitis'],
  ['hib', 'Hib', 'Routine', 'Haemophilus influenzae type b'],
  ['hpv', 'HPV', 'Routine', 'Human papillomavirus'],
  ['influenza', 'Influenza', 'Respiratory', 'Flu'],
  ['japanese-encephalitis', 'Japanese encephalitis', 'Travel & exposure'],
  ['malaria', 'Malaria', 'Travel & exposure'],
  ['measles', 'Measles', 'Routine', 'MMR'],
  ['men-acwy', 'Meningococcal ACWY', 'Meningococcal', 'Meningitis'],
  ['men-b', 'Meningococcal B', 'Meningococcal', 'Meningitis'],
  ['men-c', 'Meningococcal C', 'Meningococcal', 'Meningitis'],
  ['mumps', 'Mumps', 'Routine', 'MMR'],
  ['pertussis', 'Pertussis', 'Routine', 'Whooping cough DTP Tdap'],
  ['pneumococcal', 'Pneumococcal disease', 'Respiratory'],
  ['polio', 'Polio', 'Routine', 'Poliomyelitis IPV OPV'],
  ['rabies', 'Rabies', 'Travel & exposure'],
  ['rsv', 'RSV', 'Respiratory', 'Respiratory syncytial virus'],
  ['rotavirus', 'Rotavirus', 'Routine'],
  ['rubella', 'Rubella', 'Routine', 'MMR German measles'],
  ['shingles', 'Shingles', 'Other', 'Herpes zoster'],
  ['smallpox-mpox', 'Smallpox & mpox', 'Travel & exposure'],
  ['tetanus', 'Tetanus', 'Routine', 'DTP Tdap'],
  ['tbe', 'Tick-borne encephalitis', 'Travel & exposure', 'TBE FSME'],
  ['tuberculosis', 'Tuberculosis', 'Routine', 'BCG'],
  ['typhoid', 'Typhoid', 'Travel & exposure'],
  ['varicella', 'Varicella', 'Routine', 'Chickenpox'],
  ['yellow-fever', 'Yellow fever', 'Travel & exposure'],
];
export const diseases = rows.map(([id, name, category, aliases = '']) => ({
  id,
  name,
  category,
  aliases,
}));
export const ids = new Set(diseases.map((d) => d.id));

export const diseaseFor = (id) => diseases.find((disease) => disease.id === id);
