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
  ])('%s -> %s / %s', (raw, email, firstName, lastName) => {
    expect(splitName(raw, email)).toEqual({ firstName, lastName });
  });

  it.each([
    [undefined, 'ann@x.com'],
    ['', 'ann@x.com'],
    ['ann@x.com', 'ann@x.com'],
    ['ann', 'ann@x.com'], // Gmail shows the local part when there is no display name
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
      { email: 'ann@x.com', name: 'Ann Lee', firstName: 'Ann', lastName: 'Lee', isSender: true },
      { email: 'bob@x.com', name: 'Bob Stone', firstName: 'Bob', lastName: 'Stone', isSender: false },
    ]);
  });

  it('returns nothing for a thread with only me', () => {
    expect(
      collectParticipants([{ sender: { emailAddress: me }, recipients: [{ emailAddress: me }] }], me),
    ).toEqual([]);
  });
});
