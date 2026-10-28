import { describe, expect, it } from 'vitest';
import { collectParticipants, isAutomated, splitName } from '../src/content/participants';

describe('splitName', () => {
  it.each([
    ['Ann Lee', 'ann@x.com', 'Ann', 'Lee'],
    ['Ann Marie van Lee', 'ann@x.com', 'Ann', 'Marie van Lee'],
    ['Ann', 'ann@x.com', 'Ann', ''],
    ['Lee, Ann', 'ann@x.com', 'Ann', 'Lee'],
    ['"Ann Lee"', 'ann@x.com', 'Ann', 'Lee'],
    ['Ann Lee (Acme Inc)', 'ann@x.com', 'Ann', 'Lee'],
    ['  Ann   Lee ', 'ann@x.com', 'Ann', 'Lee'],
    ['Іван Петренко', 'ivan@x.ua', 'Іван', 'Петренко'],
    ['J. R. Smith', 'jr@x.com', 'J.', 'R. Smith'],
  ])('%s -> %s / %s', (raw, email, firstName, lastName) => {
    expect(splitName(raw, email)).toEqual({ firstName, lastName });
  });

  it.each([
    [undefined, 'ann@x.com'],
    ['', 'ann@x.com'],
    ['ann@x.com', 'ann@x.com'],
    ['ann', 'ann@x.com'], // Gmail shows the local part when there is no display name
    ['Equipment.com.ua', 'equipment@ua7.net'], // a site, not a person
    ['shop.example', 'sales@shop.example'],
  ])('no real name in %s', (raw, email) => {
    expect(splitName(raw, email)).toEqual({ firstName: '', lastName: '' });
  });
});

describe('collectParticipants', () => {
  const me = 'me@company.com';

  it('lists unique people except me, senders first', () => {
    const people = collectParticipants(
      [
        {
          sender: { emailAddress: 'me@company.com', name: 'Me' },
          recipients: [{ emailAddress: 'bob@x.com' }, { emailAddress: 'ann@x.com', name: 'Ann Lee' }],
        },
        {
          sender: { emailAddress: 'Ann@X.com', name: 'Ann Lee' },
          recipients: [{ emailAddress: 'ME@company.com' }, { emailAddress: 'bob@x.com', name: 'Bob Stone' }],
        },
      ],
      me,
    );

    expect(people).toEqual([
      {
        email: 'ann@x.com',
        name: 'Ann Lee',
        firstName: 'Ann',
        lastName: 'Lee',
        isSender: true,
        automated: false,
        details: {},
      },
      {
        email: 'bob@x.com',
        name: 'Bob Stone',
        firstName: 'Bob',
        lastName: 'Stone',
        isSender: false,
        automated: false,
        details: {},
      },
    ]);
  });

  it("reads details from each sender's own signatures, latest first", () => {
    const [ann] = collectParticipants(
      [
        {
          sender: { emailAddress: 'ann@acme.com', name: 'Ann Lee' },
          recipients: [{ emailAddress: me }],
          signature: { text: 'Hi\nBest,\nAnn Lee\nCTO, Acme Inc\n+1 415 555 0100', links: [] },
        },
        {
          sender: { emailAddress: me },
          recipients: [{ emailAddress: 'ann@acme.com' }],
          signature: { text: 'Best,\nMe\n+44 20 7946 0000', links: [] },
        },
        {
          sender: { emailAddress: 'ann@acme.com', name: 'Ann Lee' },
          recipients: [{ emailAddress: me }],
          signature: { text: 'Thanks,\nAnn\n+1 415 555 0199', links: [] },
        },
      ],
      me,
    );
    expect(ann.details).toEqual({ title: 'CTO', company: 'Acme Inc', phone: '+14155550199' });
  });

  it('returns nothing for a thread with only me', () => {
    expect(
      collectParticipants([{ sender: { emailAddress: me }, recipients: [{ emailAddress: me }] }], me),
    ).toEqual([]);
  });
});

describe('names from signatures', () => {
  it('uses the signed name when the header only has the address', () => {
    const [p] = collectParticipants(
      [
        {
          sender: {
            emailAddress: 'ivan.kovalenko@example-supplies.com',
            name: 'ivan.kovalenko@example-supplies.com',
          },
          recipients: [{ emailAddress: 'me@x.com' }],
          signature: { text: 'Прошу ціну.\nЗ повагою\nІван Коваленко\nАссет менеджер', links: [] },
        },
      ],
      'me@x.com',
    );
    expect(p).toMatchObject({
      name: 'Іван Коваленко',
      firstName: 'Іван',
      lastName: 'Коваленко',
      details: { title: 'Ассет менеджер' },
    });
    expect(p.details).not.toHaveProperty('name');
  });

  it('keeps the header name over the signature', () => {
    const [p] = collectParticipants(
      [
        {
          sender: { emailAddress: 'ann@acme.com', name: 'Ann Lee' },
          recipients: [],
          signature: { text: 'Best,\nAnnie Lee-Smith', links: [] },
        },
      ],
      'me@x.com',
    );
    expect(p).toMatchObject({ name: 'Ann Lee', firstName: 'Ann', lastName: 'Lee' });
  });
});

describe('automated senders', () => {
  it.each([
    ['notifications-noreply@linkedin.com', true],
    ['noreply@github.com', true],
    ['no-reply@accounts.google.com', true],
    ['do-not-reply@x.com', true],
    ['mailer-daemon@googlemail.com', true],
    ['newsletter@shop.com', true],
    ['ann@acme.com', false],
    ['replyto.ann@acme.com', false],
    ['alertson@acme.com', false],
  ])('%s -> %s', (email, expected) => {
    expect(isAutomated(email)).toBe(expected);
  });

  it('lists robots last, without a person name or details', () => {
    const people = collectParticipants(
      [
        {
          sender: { emailAddress: 'notifications-noreply@linkedin.com', name: 'LinkedIn' },
          recipients: [{ emailAddress: 'ann@acme.com', name: 'Ann Lee' }],
          signature: { text: 'Best,\nLinkedIn\n+1 650 687 3600', links: [] },
        },
      ],
      'me@x.com',
    );
    expect(people.map((p) => [p.email, p.automated, p.firstName, p.details])).toEqual([
      ['ann@acme.com', false, 'Ann', {}],
      ['notifications-noreply@linkedin.com', true, '', {}],
    ]);
  });
});
