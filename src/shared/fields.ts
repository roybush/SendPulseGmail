/**
 * Maps a contact's profile onto an address book's variables.
 * Books name variables freely ("name", "firstName", "Ім'я", "Company"…), so we match common
 * spellings; the user can override the result per book.
 */
import type { BookVariable } from './types';

export type PersonName = { firstName: string; lastName: string };

export type Profile = PersonName & {
  phone?: string;
  company?: string;
  title?: string;
  website?: string;
  linkedin?: string;
};

export type DetailField = 'phone' | 'company' | 'title' | 'website' | 'linkedin';
export const DETAIL_FIELDS: DetailField[] = ['phone', 'company', 'title', 'website', 'linkedin'];

/** Which book variable receives each part of the profile; missing key = not saved. */
export type FieldMapping = Partial<Record<'first' | 'last' | 'full' | DetailField, string>>;

/** Used when the book has no name-like variable; SendPulse creates it on first add. */
export const DEFAULT_NAME_VARIABLE = 'name';
/** SendPulse's built-in phone variable, present in every book. */
export const PHONE_VARIABLE = 'Phone';

const PATTERNS: Record<keyof FieldMapping, RegExp> = {
  first: /^(first[\s_-]?name|fname|given[\s_-]?name|ім['’]?я|имя)$/i,
  last: /^(last[\s_-]?name|lname|surname|family[\s_-]?name|прізвище|фамилия)$/i,
  full: /^(name|full[\s_-]?name|contact[\s_-]?name|піб|фио)$/i,
  phone: /^(phone|tel|telephone|mobile|телефон|тел)$/i,
  company: /^(company|company[\s_-]?name|organi[sz]ation|firm|компанія|компания|організація|организация)$/i,
  title: /^(title|job[\s_-]?title|position|role|посада|должность)$/i,
  website: /^(website|web[\s_-]?site|site|web|url|сайт)$/i,
  linkedin: /^(linked[\s_-]?in|linked[\s_-]?in[\s_-]?url)$/i,
};

export function detectFieldMapping(variables: Pick<BookVariable, 'name'>[]): FieldMapping {
  const mapping: FieldMapping = {};
  for (const key of Object.keys(PATTERNS) as (keyof FieldMapping)[]) {
    const match = variables.find((v) => PATTERNS[key].test(v.name.trim()))?.name;
    if (match) mapping[key] = match;
  }
  if (!mapping.first && !mapping.last && !mapping.full) mapping.full = DEFAULT_NAME_VARIABLE;
  mapping.phone ??= PHONE_VARIABLE;
  return mapping;
}

export function toVariables(profile: Profile, mapping: FieldMapping): Record<string, string> {
  const first = profile.firstName.trim();
  const last = profile.lastName.trim();
  const full = [first, last].filter(Boolean).join(' ');
  const vars: Record<string, string> = {};

  if (mapping.first && first) vars[mapping.first] = first;
  if (mapping.last && last) vars[mapping.last] = last;
  // If the book only has a first-name field, don't lose the surname.
  if (mapping.first && !mapping.last && !mapping.full && last) vars[mapping.first] = full;
  if (mapping.full && full) vars[mapping.full] = full;

  for (const field of DETAIL_FIELDS) {
    let value = profile[field]?.trim();
    // "+38 (067) 123-45-67" -> "+380671234567": SendPulse validates Phone strictly.
    if (field === 'phone') value = value?.replace(/[\s().-]/g, '');
    const variable = mapping[field];
    if (variable && value) vars[variable] = value;
  }
  return vars;
}

/** Best-effort reverse of toVariables, for prefilling from data already in SendPulse. */
export function fromVariables(variables: Record<string, string>): Profile {
  const mapping = detectFieldMapping(Object.keys(variables).map((name) => ({ name })));
  const read = (key: keyof FieldMapping) => (mapping[key] ? variables[mapping[key]]?.trim() || '' : '');

  let firstName = read('first');
  let lastName = read('last');
  if (!firstName && !lastName) {
    const [head = '', ...rest] = read('full').split(/\s+/).filter(Boolean);
    firstName = head;
    lastName = rest.join(' ');
  }

  const profile: Profile = { firstName, lastName };
  for (const field of DETAIL_FIELDS) {
    const value = read(field);
    if (value) profile[field] = value;
  }
  return profile;
}
