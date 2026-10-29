import { describe, expect, it } from 'vitest';
import {
  detectFieldMapping,
  fromVariables,
  sourceLabel,
  toVariables,
  variableChanges,
} from '../src/shared/fields';

const vars = (...names: string[]) => names.map((name) => ({ name }));
const ann = { firstName: 'Ann', lastName: 'Lee' };

describe('detectFieldMapping', () => {
  it.each([
    [['firstName', 'lastName'], { first: 'firstName', last: 'lastName', phone: 'Phone' }],
    [['first_name', 'Last Name', 'phone'], { first: 'first_name', last: 'Last Name', phone: 'phone' }],
    [['Name'], { full: 'Name', phone: 'Phone' }],
    [
      ["Ім'я", 'Прізвище', 'Компанія', 'Посада'],
      { first: "Ім'я", last: 'Прізвище', company: 'Компанія', title: 'Посада', phone: 'Phone' },
    ],
    [
      ['Company', 'Job Title', 'Website', 'LinkedIn'],
      {
        full: 'name',
        company: 'Company',
        title: 'Job Title',
        website: 'Website',
        linkedin: 'LinkedIn',
        phone: 'Phone',
      },
    ],
    [['city'], { full: 'name', phone: 'Phone' }],
  ])('%j', (names, expected) => {
    expect(detectFieldMapping(vars(...names))).toEqual(expected);
  });
});

describe('toVariables', () => {
  it('fills separate first and last name fields', () => {
    expect(toVariables(ann, { first: 'firstName', last: 'lastName' })).toEqual({
      firstName: 'Ann',
      lastName: 'Lee',
    });
  });

  it('puts the full name into a single name field', () => {
    expect(toVariables(ann, { full: 'Name' })).toEqual({ Name: 'Ann Lee' });
  });

  it('keeps the surname when the book only has a first-name field', () => {
    expect(toVariables(ann, { first: 'firstName' })).toEqual({ firstName: 'Ann Lee' });
  });

  it('saves no name when no name field is mapped', () => {
    expect(toVariables(ann, {})).toEqual({});
  });

  it('skips empty values', () => {
    expect(toVariables({ firstName: ' ', lastName: '' }, { first: 'f', last: 'l', full: 'n' })).toEqual({});
    expect(toVariables({ firstName: 'Ann', lastName: '' }, { first: 'f', last: 'l' })).toEqual({ f: 'Ann' });
  });

  it('strips formatting from the phone', () => {
    expect(toVariables({ ...ann, phone: ' +38 (067) 123-45-67 ' }, { phone: 'Phone' })).toEqual({
      Phone: '+380671234567',
    });
  });

  it('adds mapped details and drops unmapped ones', () => {
    const profile = { ...ann, phone: '+14155550132', company: 'Acme', title: 'CTO', linkedin: 'https://x' };
    expect(toVariables(profile, { full: 'Name', phone: 'Phone', company: 'Company' })).toEqual({
      Name: 'Ann Lee',
      Phone: '+14155550132',
      Company: 'Acme',
    });
  });
});

describe('fromVariables', () => {
  it('reads separate fields and details', () => {
    expect(fromVariables({ firstName: 'Ann', lastName: 'Lee', Phone: '1', Company: 'Acme' })).toEqual({
      ...ann,
      phone: '1',
      company: 'Acme',
    });
  });

  it('splits a full name field', () => {
    expect(fromVariables({ name: 'Ann Marie Lee' })).toEqual({ firstName: 'Ann', lastName: 'Marie Lee' });
  });

  it('returns empty names when nothing matches', () => {
    expect(fromVariables({ city: 'Kyiv' })).toEqual({ firstName: '', lastName: '' });
  });
});

describe('source', () => {
  it('detects a source variable and labels it with the date', () => {
    expect(detectFieldMapping([{ name: 'Джерело' }]).source).toBe('Джерело');
    expect(sourceLabel(new Date('2026-10-29T12:00:00Z'))).toBe('Gmail, 2026-10-29');
  });

  it('saves the source only when mapped', () => {
    const profile = { firstName: 'Ann', lastName: '' };
    expect(toVariables(profile, { first: 'firstName', source: 'source' }, 'Gmail, 2026-10-29')).toEqual({
      firstName: 'Ann',
      source: 'Gmail, 2026-10-29',
    });
    expect(toVariables(profile, { first: 'firstName' }, 'Gmail, 2026-10-29')).toEqual({ firstName: 'Ann' });
  });
});

describe('variableChanges', () => {
  it('lists new and changed values, never erasing or touching Phone', () => {
    expect(
      variableChanges(
        { name: 'Ann Lee', Company: 'Acme Inc', title: 'CTO', Phone: '+380501112233' },
        { name: 'Ann Lee', Company: 'Acme', Phone: '+380500000000', website: 'acme.com' },
      ),
    ).toEqual([
      { name: 'Company', from: 'Acme', to: 'Acme Inc' },
      { name: 'title', from: '', to: 'CTO' },
    ]);
  });
});
