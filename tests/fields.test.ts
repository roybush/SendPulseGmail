import { describe, expect, it } from 'vitest';
import { detectNameFields, fromVariables, toVariables } from '../src/shared/fields';

const vars = (...names: string[]) => names.map((name) => ({ name }));
const ann = { firstName: 'Ann', lastName: 'Lee' };

describe('detectNameFields', () => {
  it.each([
    [['firstName', 'lastName'], { first: 'firstName', last: 'lastName', full: undefined }],
    [['first_name', 'Last Name', 'Phone'], { first: 'first_name', last: 'Last Name', full: undefined }],
    [['Name'], { first: undefined, last: undefined, full: 'Name' }],
    [["Ім'я", 'Прізвище'], { first: "Ім'я", last: 'Прізвище', full: undefined }],
    [['Phone', 'company'], { first: undefined, last: undefined, full: undefined }],
  ])('%j', (names, expected) => {
    expect(detectNameFields(vars(...names))).toEqual(expected);
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

  it('falls back to a "name" variable when the book has none', () => {
    expect(toVariables(ann, {})).toEqual({ name: 'Ann Lee' });
  });

  it('skips empty values', () => {
    expect(toVariables({ firstName: ' ', lastName: '' }, { first: 'f', last: 'l', full: 'n' })).toEqual({});
    expect(toVariables({ firstName: 'Ann', lastName: '' }, { first: 'f', last: 'l' })).toEqual({ f: 'Ann' });
  });
});

describe('fromVariables', () => {
  it('reads separate fields', () => {
    expect(fromVariables({ firstName: 'Ann', lastName: 'Lee', Phone: '1' })).toEqual(ann);
  });

  it('splits a full name field', () => {
    expect(fromVariables({ name: 'Ann Marie Lee' })).toEqual({ firstName: 'Ann', lastName: 'Marie Lee' });
  });

  it('returns empty names when nothing matches', () => {
    expect(fromVariables({ Phone: '1' })).toEqual({ firstName: '', lastName: '' });
  });
});
