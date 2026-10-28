/**
 * Best-effort extraction of contact details from an email signature.
 * Pure text in, partial profile out: no DOM, so it's easy to test against real signatures.
 */

export type ContactDetails = {
  /** A person's name found at the top of the signature. */
  name?: string;
  phone?: string;
  company?: string;
  title?: string;
  website?: string;
  linkedin?: string;
};

export type SignatureSource = {
  /** Message text with quoted replies removed, one line per visual line. */
  text: string;
  /** Hrefs of links in that text. */
  links: string[];
};

const VALEDICTION = new RegExp(
  `^(${[
    'best|best regards|kind regards|warm regards|regards|cheers|thanks|thank you|many thanks|sincerely|yours|br',
    'з повагою|з найкращими побажаннями|дякую|щиро|с уважением|спасибо|всего доброго',
    'saludos|un saludo|saludos cordiales|atentamente|cordialmente|gracias|muchas gracias|un abrazo',
    'mit freundlichen grüßen|freundliche grüße|beste grüße|viele grüße|liebe grüße|herzliche grüße|danke|vielen dank|mfg|lg',
    'atenciosamente|cumprimentos|saudações|abraços|abraço|um abraço|obrigado|obrigada|att',
    'pozdrawiam|serdecznie pozdrawiam|z poważaniem|z wyrazami szacunku|dziękuję|pozdrowienia',
    'saygılarımla|iyi çalışmalar|İyi çalışmalar|teşekkürler|teşekkür ederim|selamlar|sevgiler',
    'cordialement|bien cordialement|bien à vous|salutations|sincères salutations|merci|merci beaucoup|bonne journée|amicalement',
  ].join('|')})[\\s,.!—-]*$`,
  'i',
);
const SIGNATURE_DELIMITER = /^--\s*$/;
const MAX_SIGNATURE_LINES = 10;

const PHONE_LABEL =
  /^(tel|phone|mob|mobile|cell|office|direct|whatsapp|viber|telegram|т|тел|телефон|моб|мобільний|мобильный|tlf|teléfono|telefono|móvil|movil|celular|cel|handy|mobil|telefon|tél|téléphone|portable|komórka|kom|cep|gsm)\.?\s*[:.]?\s*/i;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;
const LINKEDIN = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(in|company)\/([\w%.-]+)/i;
const URL_IN_TEXT =
  /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s]*)?)/i;
const NOT_A_WEBSITE =
  /(linkedin|facebook|fb\.com|twitter|x\.com|instagram|youtube|t\.me|wa\.me|google\.|gmail\.|calendly|zoom\.us|mailto:|tel:)/i;
// `\b` only knows ASCII letters, so word edges are spelled out to work for Cyrillic too.
const word = (alternatives: string) => new RegExp(`(?<![\\p{L}\\d])(${alternatives})(?![\\p{L}\\d])`, 'iu');
const LEGAL_FORM = word(
  [
    'llc|inc|ltd|limited|gmbh|ag|corp|corporation|co\\.|plc|llp|s\\.a\\.|sp\\. z o\\.o\\.|тов|пп|фоп|ооо|зао|пао|ат',
    // Short forms like SA, SL or ME are left out: they collide with ordinary words.
    's\\.l\\.|s\\.a\\.s\\.|sas|sarl|ltda|e\\.k\\.|ohg|a\\.ş\\.|şti|s\\.r\\.l\\.|srl|b\\.v\\.|spółka',
  ].join('|'),
);
const TITLE_WORDS = word(
  [
    'ceo|cto|cfo|coo|cmo|vp|founder|co-founder|owner|president|director|head|manager|lead|engineer',
    'developer|designer|consultant|specialist|officer|partner|analyst|architect|executive|coordinator',
    'assistant|representative|sales|marketing|account|recruiter|hr|product|project',
    'директор|менеджер|керівник|засновник|співзасновник|інженер|розробник|дизайнер|консультант',
    'спеціаліст|фахівець|аналітик|бухгалтер|юрист|керуючий|начальник|руководитель|основатель',
    'разработчик|специалист',
    'gerente|director|directora|jefe|jefa|responsable|fundador|fundadora|ingeniero|ingeniera|desarrollador',
    'desarrolladora|consultor|consultora|asesor|asesora|ventas|comercial',
    'geschäftsführer|geschäftsführerin|leiter|leiterin|inhaber|inhaberin|gründer|gründerin|vertrieb|berater',
    'beraterin|entwickler|entwicklerin|ingenieur|ingenieurin|projektleiter|projektleiterin',
    'diretor|diretora|engenheiro|engenheira|desenvolvedor|desenvolvedora|vendas|coordenador|coordenadora',
    'kierownik|kierowniczka|dyrektor|dyrektorka|prezes|właściciel|właścicielka|założyciel|założycielka',
    'specjalista|specjalistka|inżynier|programista|programistka|handlowiec|konsultantka|koordynator|menedżer',
    'przedstawiciel',
    'müdür|müdürü|yönetici|kurucu|uzman|mühendis|geliştirici|danışman|satış|temsilci|koordinatör',
    'directeur|directrice|gérant|gérante|fondateur|fondatrice|ingénieur|ingénieure|développeur|développeuse',
    'consultante|commerciale|chef|chargé|chargée',
  ].join('|'),
);
const TITLE_COMPANY_SEPARATOR = /\s+(?:at|@|\||—|–|-|в|у|en|na|no|em|chez|bei|w)\s+|,\s+/i;

const FREE_MAIL =
  /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|proton|protonmail|pm|gmx|mail|yandex|ya|ukr|i|meta|bigmir|rambler|zoho|fastmail|tutanota)\./i;

/** Lines that most likely form the signature: after "--" or a sign-off, else the last few. */
export function signatureLines(text: string): string[] {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const start = lines.findLastIndex((l) => SIGNATURE_DELIMITER.test(l) || VALEDICTION.test(l));
  const tail = start >= 0 ? lines.slice(start + 1) : lines.slice(-MAX_SIGNATURE_LINES);
  return tail.slice(0, MAX_SIGNATURE_LINES);
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return raw.trim().startsWith('+') ? `+${digits}` : digits;
}

export function normalizeLinkedin(raw: string): string | undefined {
  const m = raw.match(LINKEDIN);
  return m ? `https://www.linkedin.com/${m[1].toLowerCase()}/${m[2].replace(/[/.]+$/, '')}` : undefined;
}

function normalizeWebsite(raw: string): string {
  const url = raw.replace(/[).,;]+$/, '');
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function hostOf(url: string): string {
  try {
    return new URL(normalizeWebsite(url)).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** A company site guessed from the address, unless it's a free mail provider. */
export function websiteFromEmail(email: string): string | undefined {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || FREE_MAIL.test(domain)) return undefined;
  return `https://${domain}`;
}

const NAME_WORD = /^\p{Lu}[\p{Ll}'’-]+$/u;

/** "Іван Коваленко", "Ann Marie Lee": 2–3 capitalised words, not a title or a company. */
function looksLikeName(line: string): boolean {
  const words = line.split(' ');
  return (
    words.length >= 2 &&
    words.length <= 3 &&
    words.every((w) => NAME_WORD.test(w)) &&
    !TITLE_WORDS.test(line) &&
    !LEGAL_FORM.test(line)
  );
}

/** Drops a quote left without its pair: 'ТОВ Приклад Агро"' -> 'ТОВ Приклад Агро'. */
function tidy(line: string): string {
  const count = (re: RegExp) => (line.match(re) ?? []).length;
  let out = line;
  if (count(/"/g) % 2) out = out.replace(/"(?=[^"]*$)/, '');
  const opens = count(/[«“]/g);
  const closes = count(/[»”]/g);
  if (closes > opens) out = out.replace(/[»”](?=[^»”]*$)/, '');
  if (opens > closes) out = out.replace(/[«“]/, '');
  return out.trim();
}

function isContactLine(line: string): boolean {
  return PHONE.test(line) || URL_IN_TEXT.test(line) || line.includes('@');
}

function isNameLine(line: string, name: string): boolean {
  const parts = name.toLowerCase().split(/\s+/).filter(Boolean);
  const l = line.toLowerCase();
  return (
    parts.length > 0 && parts.every((p) => l.includes(p)) && line.split(/\s+/).length <= parts.length + 1
  );
}

export function parseSignature(
  source: SignatureSource,
  person: { email: string; name: string },
): ContactDetails {
  const lines = signatureLines(source.text);
  const details: ContactDetails = {};

  for (const line of lines) {
    const phone = line.replace(PHONE_LABEL, '').match(PHONE);
    if (!details.phone && phone && phone[1].replace(/\D/g, '').length >= 9) {
      details.phone = normalizePhone(phone[1]);
    }
  }

  details.linkedin = source.links.map(normalizeLinkedin).find(Boolean) ?? normalizeLinkedin(source.text);

  const emailHost = person.email.split('@')[1]?.toLowerCase() ?? '';
  // Only links that show up in the signature itself: a product link in the body isn't their site.
  const signatureText = lines.join(' ').toLowerCase();
  const candidates = [
    ...source.links.filter((u) => signatureText.includes(hostOf(u))),
    ...lines.flatMap((l) => (l.includes('@') ? [] : [l.match(URL_IN_TEXT)?.[1] ?? ''])),
  ].filter((u) => u && !NOT_A_WEBSITE.test(u) && hostOf(u));
  const website =
    candidates.find((u) => {
      const host = hostOf(u);
      return host === emailHost || emailHost.endsWith(`.${host}`);
    }) ?? candidates[0];
  if (website) details.website = normalizeWebsite(website);

  // The name usually opens the signature.
  const nameLine = lines.slice(0, 2).find(looksLikeName);
  if (nameLine) details.name = nameLine;

  // Title and company: plain lines near the name, e.g. "Head of Sales, Acme Inc" or "CTO" / "Acme".
  const plain = lines
    .filter((l) => l !== nameLine && !isContactLine(l) && !isNameLine(l, person.name) && l.length <= 80)
    .map(tidy);
  for (const line of plain) {
    if (!details.title && TITLE_WORDS.test(line)) {
      const [title, ...rest] = line.split(TITLE_COMPANY_SEPARATOR);
      details.title = title.trim();
      if (rest.length && !details.company) details.company = rest.join(', ').trim();
      continue;
    }
    if (!details.company && (LEGAL_FORM.test(line) || (details.title && line.split(/\s+/).length <= 5))) {
      details.company = line;
    }
  }

  return Object.fromEntries(Object.entries(details).filter(([, v]) => v)) as ContactDetails;
}
