import { describe, expect, it } from 'vitest';
import { collectParticipants, splitName } from '../src/content/participants';

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
      { email: 'ann@x.com', name: 'Ann Lee', firstName: 'Ann', lastName: 'Lee', isSender: true, details: {} },
      {
        email: 'bob@x.com',
        name: 'Bob Stone',
        firstName: 'Bob',
        lastName: 'Stone',
        isSender: false,
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
