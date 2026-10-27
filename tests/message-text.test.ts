// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { messageSignatureSource } from '../src/content/message-text';

function body(html: string) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('messageSignatureSource', () => {
  it('turns blocks and <br> into lines', () => {
    const { text } = messageSignatureSource(body('<div>Hi</div><div>Best,<br>Ann Lee<br>CTO</div>'));
    expect(text.split('\n').filter(Boolean)).toEqual(['Hi', 'Best,', 'Ann Lee', 'CTO']);
  });

  it('drops quoted replies', () => {
    const { text, links } = messageSignatureSource(
      body(
        '<div>Thanks!<br>Bob</div>' +
          '<div class="gmail_quote"><div class="gmail_attr">On Mon, Ann wrote:</div>' +
          '<blockquote>Best,<br>Ann Lee<br><a href="https://acme.com">acme.com</a></blockquote></div>',
      ),
    );
    expect(text).not.toContain('Ann Lee');
    expect(links).toEqual([]);
  });

  it('stops at a plain-text reply header', () => {
    const { text } = messageSignatureSource(
      body('<div>Ok</div><div>Bob</div><div>On Tue, 3 Mar 2026, Ann Lee wrote:</div><div>&gt; old</div>'),
    );
    expect(text).not.toContain('old');
    expect(text).toContain('Bob');
  });

  it('uses only the Gmail-marked signature when present', () => {
    const { text, links } = messageSignatureSource(
      body(
        '<div>See <a href="https://docs.example.com/x">doc</a></div>' +
          '<div class="gmail_signature"><div>Ann Lee</div><div><a href="https://acme.com/">acme.com</a></div></div>',
      ),
    );
    expect(text.split('\n').filter(Boolean)).toEqual(['Ann Lee', 'acme.com']);
    expect(links).toEqual(['https://acme.com/']);
  });

  it('keeps only web links', () => {
    const { links } = messageSignatureSource(
      body('<a href="mailto:a@b.c">mail</a><a href="tel:+1">call</a><a href="http://x.io">x</a>'),
    );
    expect(links).toEqual(['http://x.io']);
  });
});
