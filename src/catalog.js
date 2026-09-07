export const WHO_SOURCE = 'https://www.who.int/teams/immunization-vaccines-and-biologicals/diseases';
export const WHO_SCHEDULES = 'https://www.who.int/teams/immunization-vaccines-and-biologicals/policies/who-recommendations-for-routine-immunization---summary-tables';
export const FINLAND_SOURCE = 'https://www.rokotesuoja.fi/miksi-rokottautua/kansallinen-rokotusohjelma';
export const adultTargets = { diphtheria: 3, tetanus: 3, pertussis: 3, polio: 3, measles: 2, mumps: 2, rubella: 2 };
export const guidance = {
  diphtheria: 'Finnish adult boosters: at ages 25, 45 and 65, then every 10 years. Record your next appointment separately.',
  tetanus: 'Finnish adult boosters: at ages 25, 45 and 65, then every 10 years. Wound care may require a separate assessment.',
  pertussis: 'The Finnish adult programme includes a booster at 25. Pregnancy and other circumstances may change your plan.',
  polio: 'The Finnish reference does not specify routine adult boosters after the primary series; travel or exposure can change this.',
  measles: 'The Finnish adult reference uses two MMR doses or a history of the disease. This tracker counts recorded doses only.',
  mumps: 'The Finnish adult reference uses two MMR doses or a history of the disease. This tracker counts recorded doses only.',
  rubella: 'The Finnish adult reference uses two MMR doses or a history of the disease. This tracker counts recorded doses only.',
  influenza: 'The Finnish programme offers annual vaccination to adults aged 65+ and risk groups. Set a reminder for the next seasonal review.',
  'hepatitis-a': 'Schedules depend on the product and age. Set your agreed dose target; do not infer it from the brand name alone.',
  'hepatitis-b': 'A three-dose series is common; age and product can change the schedule. Confirm your personal target.',
};
export const combinations = [
  { id: 'mmr', name: 'MMR · measles, mumps & rubella', ids: ['measles', 'mumps', 'rubella'] },
  { id: 'dt', name: 'dT · diphtheria & tetanus', ids: ['diphtheria', 'tetanus'] },
  { id: 'dtap', name: 'DTP / Tdap · diphtheria, tetanus & pertussis', ids: ['diphtheria', 'tetanus', 'pertussis'] },
  { id: 'dtap-ipv', name: 'DTP-IPV · DTP & polio', ids: ['diphtheria', 'tetanus', 'pertussis', 'polio'] },
  { id: 'hepa-b', name: 'Hepatitis A & B', ids: ['hepatitis-a', 'hepatitis-b'] },
];
// WHO “Available vaccines”, reviewed 2026-09-07. Grouped diseases are split
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
export const diseases = rows.map(([id, name, category, aliases = '']) => ({ id, name, category, aliases }));
export const ids = new Set(diseases.map(d => d.id));
