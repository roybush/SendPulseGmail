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
      name: 'Ann Lee',
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
      name: 'Олена Коваль',
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
      name: 'Bob Stone',
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

  it('reads a Ukrainian request with a disclaimer and a product link in the body', () => {
    const text = `Доброго дня.

Прошу надати цінову пропозицію на товар:
Electronic load, single channel, 150V, 500A
https://shop.example.com/product/12345

З повагою

Іван Коваленко
Ассет менеджер
ТОВ Приклад Агро"
+380671112233

Повідомлення про конфіденційність Це повідомлення (включно з вкладеними файлами) містить конфіденційну інформацію та призначене для використання виключно адресатами, яким воно направлено.`;
    const email = 'ivan.kovalenko@example-supplies.com';

    expect(parse(text, ['https://shop.example.com/product/12345'], { email, name: email })).toEqual({
      name: 'Іван Коваленко',
      title: 'Ассет менеджер',
      company: 'ТОВ Приклад Агро',
      phone: '+380671112233',
    });
  });

  it.each([
    [
      'Spanish',
      'Hola,\n\nTe envío la propuesta.\n\nSaludos cordiales,\nLucía Martín\nGerente de Ventas en Ejemplo Digital S.L.\nMóvil: +34 612 345 678',
      { email: 'lucia@ejemplo.es', name: 'Lucía Martín' },
      {
        name: 'Lucía Martín',
        title: 'Gerente de Ventas',
        company: 'Ejemplo Digital S.L.',
        phone: '+34612345678',
      },
    ],
    [
      'German',
      'Hallo,\n\nanbei das Angebot.\n\nMit freundlichen Grüßen\nJonas Weber\nGeschäftsführer\nBeispiel Technik GmbH\nTel.: +49 30 1234567',
      { email: 'jonas.weber@beispiel.de', name: 'Jonas Weber' },
      {
        name: 'Jonas Weber',
        title: 'Geschäftsführer',
        company: 'Beispiel Technik GmbH',
        phone: '+49301234567',
      },
    ],
    [
      'Portuguese',
      'Olá,\n\nSegue o orçamento.\n\nAtenciosamente,\nAna Souza\nDiretora Comercial na Exemplo Ltda\nCelular: +55 11 91234-5678',
      { email: 'ana@exemplo.com.br', name: 'Ana Souza' },
      { name: 'Ana Souza', title: 'Diretora Comercial', company: 'Exemplo Ltda', phone: '+5511912345678' },
    ],
    [
      'Polish',
      'Dzień dobry,\n\nw załączniku oferta.\n\nPozdrawiam\nMarek Nowak\nKierownik ds. sprzedaży\nPrzykład Sp. z o.o.\ntel. +48 512 345 678',
      { email: 'marek@przyklad.pl', name: 'Marek Nowak' },
      {
        name: 'Marek Nowak',
        title: 'Kierownik ds. sprzedaży',
        company: 'Przykład Sp. z o.o.',
        phone: '+48512345678',
      },
    ],
    [
      'Turkish',
      'Merhaba,\n\nTeklifimiz ektedir.\n\nSaygılarımla,\nAyşe Yılmaz\nSatış Müdürü\nÖrnek Yazılım A.Ş.\nCep: +90 532 123 45 67',
      { email: 'ayse@ornek.com.tr', name: 'Ayşe Yılmaz' },
      { name: 'Ayşe Yılmaz', title: 'Satış Müdürü', company: 'Örnek Yazılım A.Ş.', phone: '+905321234567' },
    ],
    [
      'French',
      'Bonjour,\n\nVoici notre devis.\n\nCordialement,\nCamille Durand\nResponsable commerciale chez Exemple SARL\nTél. : +33 6 12 34 56 78',
      { email: 'camille@exemple.fr', name: 'Camille Durand' },
      {
        name: 'Camille Durand',
        title: 'Responsable commerciale',
        company: 'Exemple SARL',
        phone: '+33612345678',
      },
    ],
  ])('reads a %s signature', (_, text, person, expected) => {
    expect(parse(text, [], person)).toEqual(expected);
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
