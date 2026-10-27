import { describe, expect, it } from 'vitest';
import {
  normalizeLinkedin,
  normalizePhone,
  parseSignature,
  signatureLines,
  websiteFromEmail,
} from '../src/content/signature';

const ann = { email: 'ann.lee@acme.com', name: 'Ann Lee' };

function parse(text: string, links: string[] = [], person = ann) {
  return parseSignature({ text, links }, person);
}

describe('signatureLines', () => {
  it('takes lines after a sign-off', () => {
    expect(signatureLines('Hi Bob,\n\nSounds good.\n\nBest regards,\nAnn Lee\nCTO')).toEqual([
      'Ann Lee',
      'CTO',
    ]);
  });

  it('takes lines after the "-- " delimiter', () => {
    expect(signatureLines('Text\n-- \nAnn Lee\nAcme')).toEqual(['Ann Lee', 'Acme']);
  });

  it('falls back to the last lines', () => {
    const text = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');
    expect(signatureLines(text)).toHaveLength(10);
    expect(signatureLines(text).at(-1)).toBe('line 19');
  });
});

describe('parseSignature', () => {
  it('reads a typical English signature', () => {
    const text = `Hi,

Let's talk next week.

Best regards,
Ann Lee
Head of Sales, Acme Inc.
Tel: +1 (415) 555-0132
www.acme.com
linkedin.com/in/ann-lee-42`;

    expect(parse(text)).toEqual({
      phone: '+14155550132',
      title: 'Head of Sales',
      company: 'Acme Inc.',
      website: 'https://www.acme.com',
      linkedin: 'https://www.linkedin.com/in/ann-lee-42',
    });
  });

  it('reads a Ukrainian signature with title and company on separate lines', () => {
    const text = `Добрий день!

Надсилаю рахунок.

З повагою,
Олена Коваль
Менеджер з продажу
ТОВ «Обладнання Плюс»
моб. +38 (067) 123-45-67
https://equipment.com.ua`;

    expect(parse(text, [], { email: 'sales@equipment.com.ua', name: 'Олена Коваль' })).toEqual({
      phone: '+380671234567',
      title: 'Менеджер з продажу',
      company: 'ТОВ «Обладнання Плюс»',
      website: 'https://equipment.com.ua',
    });
  });

  it('handles "Title at Company" and links from HTML', () => {
    const text = 'Thanks,\nBob Stone\nFounder at Stone Labs\nstonelabs.io | LinkedIn';
    expect(
      parse(text, ['https://stonelabs.io/', 'https://ua.linkedin.com/in/bobstone/'], {
        email: 'bob@stonelabs.io',
        name: 'Bob Stone',
      }),
    ).toEqual({
      title: 'Founder',
      company: 'Stone Labs',
      website: 'https://stonelabs.io/',
      linkedin: 'https://www.linkedin.com/in/bobstone',
    });
  });

  it('prefers the website on the sender domain over other links', () => {
    const text = 'Best,\nAnn\nhttps://partner.example.org\nhttps://acme.com';
    expect(parse(text).website).toBe('https://acme.com');
  });

  it('ignores social links, emails and short numbers', () => {
    const text = 'Cheers,\nAnn\nann.lee@acme.com\nRoom 101\nfacebook.com/ann';
    expect(parse(text)).toEqual({});
  });

  it('returns nothing for a message without a signature', () => {
    expect(parse('ok')).toEqual({});
  });
});

describe('helpers', () => {
  it.each([
    ['+1 (415) 555-0132', '+14155550132'],
    ['(044) 123-45-67', '0441234567'],
    ['+38 067 123 45 67', '+380671234567'],
  ])('normalizePhone(%s)', (raw, phone) => {
    expect(normalizePhone(raw)).toBe(phone);
  });

  it.each([
    ['linkedin.com/in/ann-lee-42/', 'https://www.linkedin.com/in/ann-lee-42'],
    ['https://www.linkedin.com/company/acme', 'https://www.linkedin.com/company/acme'],
    ['https://example.com', undefined],
  ])('normalizeLinkedin(%s)', (raw, url) => {
    expect(normalizeLinkedin(raw)).toBe(url);
  });

  it.each([
    ['ann@acme.com', 'https://acme.com'],
    ['ann@gmail.com', undefined],
    ['ivan@ukr.net', undefined],
  ])('websiteFromEmail(%s)', (email, site) => {
    expect(websiteFromEmail(email)).toBe(site);
  });
});
