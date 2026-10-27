/**
 * Maps a person's first/last name onto an address book's variables.
 * Books name these variables freely ("name", "firstName", "Ім'я"…), so we match common spellings.
 */
import type { BookVariable } from './types';

const FIRST = /^(first[\s_-]?name|fname|given[\s_-]?name|ім['’]?я|имя)$/i;
const LAST = /^(last[\s_-]?name|lname|surname|family[\s_-]?name|прізвище|фамилия)$/i;
const FULL = /^(name|full[\s_-]?name|contact[\s_-]?name|піб|фио)$/i;

/** Used when the book has no name-like variable; SendPulse creates it on first add. */
export const DEFAULT_NAME_VARIABLE = 'name';

export type NameFields = { first?: string; last?: string; full?: string };

export type PersonName = { firstName: string; lastName: string };

export function detectNameFields(variables: Pick<BookVariable, 'name'>[]): NameFields {
  const find = (re: RegExp) => variables.find((v) => re.test(v.name.trim()))?.name;
  return { first: find(FIRST), last: find(LAST), full: find(FULL) };
}

export function toVariables({ firstName, lastName }: PersonName, fields: NameFields): Record<string, string> {
  const first = firstName.trim();
  const last = lastName.trim();
  const full = [first, last].filter(Boolean).join(' ');
  const vars: Record<string, string> = {};

  if (fields.first && first) vars[fields.first] = first;
  if (fields.last && last) vars[fields.last] = last;
  // If the book only has a first-name field, don't lose the surname.
  if (fields.first && !fields.last && !fields.full && last) vars[fields.first] = full;
  if (fields.full && full) vars[fields.full] = full;
  if (!fields.first && !fields.last && !fields.full && full) vars[DEFAULT_NAME_VARIABLE] = full;
  return vars;
}

/** Best-effort reverse of toVariables, for prefilling from data already in SendPulse. */
export function fromVariables(variables: Record<string, string>): PersonName {
  const fields = detectNameFields(Object.keys(variables).map((name) => ({ name })));
  const first = fields.first ? variables[fields.first]?.trim() : '';
  const last = fields.last ? variables[fields.last]?.trim() : '';
  if (first || last) return { firstName: first ?? '', lastName: last ?? '' };

  const full = fields.full ? (variables[fields.full]?.trim() ?? '') : '';
  const [firstName = '', ...rest] = full.split(/\s+/).filter(Boolean);
  return { firstName, lastName: rest.join(' ') };
}
