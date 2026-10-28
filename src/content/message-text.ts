import type { SignatureSource } from './signature';

/** Quoted earlier messages and Gmail's own wrappers around them. */
const QUOTED =
  'blockquote, .gmail_quote, .gmail_extra, .gmail_attr, .yahoo_quoted, #divRplyFwdMsg, #appendonsend';
const BLOCK = /^(ADDRESS|BLOCKQUOTE|BR|DIV|H[1-6]|HR|LI|OL|P|PRE|TABLE|TD|TH|TR|UL)$/;
// Plain-text replies quote below a line like this; everything after it is someone else's.
const REPLY_HEADER = new RegExp(
  `^(${[
    'on .+ wrote:|.+ написав\\(ла\\):|.+ пише:|.+ писал\\(а\\):|-{2,}\\s*original message\\s*-{2,}',
    'el .+ escribió:|am .+ schrieb .+:|em .+ escreveu:|.+ napisał\\(a\\):|w dniu .+ napisał.*|.+ şunu yazdı:',
    'le .+ a écrit\\s?:',
    // Outlook-style quote headers
    '(from|de|von|od|kimden|від|от):\\s.+',
  ].join('|')})$`,
  'i',
);

/**
 * Text and links of a message body, without quoted replies.
 * If Gmail marked the signature (`.gmail_signature`), only that part is used.
 */
export function messageSignatureSource(body: HTMLElement): SignatureSource {
  const root = body.cloneNode(true) as HTMLElement;
  root.querySelectorAll(QUOTED).forEach((el) => el.remove());
  const scope = root.querySelector<HTMLElement>('.gmail_signature') ?? root;

  const lines: string[] = [];
  for (const line of toText(scope).split('\n')) {
    if (REPLY_HEADER.test(line.trim())) break;
    lines.push(line);
  }

  const links = [...scope.querySelectorAll('a[href]')]
    .map((a) => a.getAttribute('href') ?? '')
    .filter((href) => /^https?:\/\//i.test(href));

  return { text: lines.join('\n'), links };
}

/** innerText without layout: block elements and <br> become line breaks. */
function toText(node: Node): string {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent?.replace(/\s+/g, ' ') ?? '';
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') return;
      const block = BLOCK.test(el.tagName);
      if (block) out += '\n';
      out += toText(el);
      if (block) out += '\n';
    }
  });
  return out;
}
