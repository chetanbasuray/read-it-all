import { describe, it, expect } from 'vitest';
import { extractTitle, extractFromJsonLd, extractArticle } from '@/lib/scraper';

function page(head: string, body = '<article><p>x</p></article>'): string {
  return `<html><head>${head}</head><body>${body}</body></html>`;
}

describe('extractTitle site-name suffix', () => {
  const site = '<meta property="og:site_name" content="Defence Security Asia">';

  it.each([
    [' - ', 'India Test-Fires Agni-4'],
    [' | ', 'India Test-Fires Agni-4'],
    [' – ', 'India Test-Fires Agni-4'],
  ])('strips a "%s" separated publisher suffix', (sep, expected) => {
    const html = page(`${site}<meta property="og:title" content="${expected}${sep}Defence Security Asia">`);
    expect(extractTitle(html)).toBe(expected);
  });

  it('leaves a title that does not carry the suffix untouched', () => {
    const html = page(`${site}<meta property="og:title" content="India Test-Fires Agni-4">`);
    expect(extractTitle(html)).toBe('India Test-Fires Agni-4');
  });

  it('does not strip the site name from the middle of a headline', () => {
    const html = page(`${site}<meta property="og:title" content="Defence Security Asia expands coverage">`);
    expect(extractTitle(html)).toBe('Defence Security Asia expands coverage');
  });

  it('is a no-op when og:site_name is absent', () => {
    const html = page('<meta property="og:title" content="A headline - Some Site">');
    expect(extractTitle(html)).toBe('A headline - Some Site');
  });
});

describe('JSON-LD articleBody normalisation', () => {
  const body = (text: string) =>
    page(`<script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', headline: 'H', articleBody: text })}</script>`);

  it('decodes a double-escaped entity so a quote is not shown as literal &quot;', () => {
    const text = 'The Minister said &amp;quot;initiated efforts&amp;quot; to join. ' + 'Padding sentence. '.repeat(20);
    const out = extractFromJsonLd(body(text));
    expect(out!.content).toContain('"initiated efforts"');
    expect(out!.content).not.toContain('&amp;quot;');
  });

  it('restores the space between welded sentences when the body has no newlines', () => {
    const text = 'The panel has said.In its report presented today it argued the case. ' + 'More prose here. '.repeat(20);
    const out = extractFromJsonLd(body(text));
    expect(out!.textContent).toContain('said. In its report');
    expect(out!.textContent).not.toContain('said.In');
  });

  it('leaves a body that already has newlines alone', () => {
    const text = 'First para ends.\nSecond para starts. ' + 'Filler sentence. '.repeat(20);
    const out = extractFromJsonLd(body(text));
    expect(out!.content).toContain('<p>First para ends.</p>');
  });

  it('does not split an uppercase abbreviation such as U.S.', () => {
    const text = 'Officials in the U.S.Department confirmed the plan today. ' + 'Filler sentence. '.repeat(20);
    const out = extractFromJsonLd(body(text));
    // "S." is uppercase before the period, so it must not be treated as a sentence end
    expect(out!.textContent).toContain('U.S.Department');
  });
});

describe('placeholder bylines', () => {
  it.each(['admin', 'Admin', 'ADMIN', 'administrator', 'author', 'user', 'guest'])(
    'rejects the CMS default byline %s',
    (name) => {
      const html = page(
        `<meta name="author" content="${name}">`,
        `<article><h1>Headline</h1>${'<p>Real article prose that is long enough to be extracted by readability and pass the length threshold comfortably.</p>'.repeat(6)}</article>`,
      );
      expect(extractArticle(html, 'https://example.com/a')?.byline).toBeNull();
    },
  );

  it('keeps a real byline that merely contains a placeholder word', () => {
    const html = page(
      '<meta name="author" content="Adminder Singh">',
      `<article><h1>Headline</h1>${'<p>Real article prose that is long enough to be extracted by readability and pass the length threshold comfortably.</p>'.repeat(6)}</article>`,
    );
    expect(extractArticle(html, 'https://example.com/a')?.byline).toBe('Adminder Singh');
  });
});

describe('duplicate lead image behind an image proxy', () => {
  const prose = '<p>Real article prose long enough for readability to accept this as a body without trouble.</p>'.repeat(6);
  const dims4 = (w: number, fmt: string) =>
    `https://www.politico.com/dims4/default/resize/${w}/quality/90/format/${fmt}?url=` +
    encodeURIComponent('https://static.politico.com/0b/d9/0bb17b3e/birthrateimmigration30.jpg');

  it('strips the in-body twin when only the proxy transform differs', () => {
    const html = `<html><head>
      <meta property="og:image" content="${dims4(1200, 'jpg')}">
      <meta property="og:title" content="Headline">
      </head><body><article><h1>Headline</h1>
      <figure><img src="${dims4(630, 'webp')}"></figure>${prose}</article></body></html>`;
    const article = extractArticle(html, 'https://www.politico.com/news/x')!;
    expect(article.image).toBe(dims4(1200, 'jpg'));
    expect(article.content).not.toContain('birthrateimmigration30');
  });

  it('keeps a genuinely different in-body photo', () => {
    const other =
      'https://www.politico.com/dims4/default/resize/630/quality/90/format/webp?url=' +
      encodeURIComponent('https://static.politico.com/92/d4/f550587d/birthrateimmigration09.jpg');
    const html = `<html><head>
      <meta property="og:image" content="${dims4(1200, 'jpg')}">
      <meta property="og:title" content="Headline">
      </head><body><article><h1>Headline</h1>
      <figure><img src="${other}"></figure>${prose}</article></body></html>`;
    const article = extractArticle(html, 'https://www.politico.com/news/x')!;
    expect(article.content).toContain('birthrateimmigration09');
  });
});

describe('articleBody decode must never lose text', () => {
  const body = (text: string) =>
    page(`<script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', headline: 'H', articleBody: text })}</script>`);
  const pad = 'Filler sentence for length. '.repeat(20);

  it('keeps everything after a stray "<", which an HTML parse would truncate', () => {
    const out = extractFromJsonLd(body(`Range is < 5 miles. TAIL_MARKER_KEPT. ${pad}`));
    expect(out!.textContent).toContain('TAIL_MARKER_KEPT');
  });

  it('keeps a lone ampersand and does not treat it as an entity', () => {
    const out = extractFromJsonLd(body(`Smith & Jones reported. TAIL_MARKER_KEPT. ${pad}`));
    expect(out!.textContent).toContain('Smith & Jones');
    expect(out!.textContent).toContain('TAIL_MARKER_KEPT');
  });

  it('decodes a numeric double-escaped entity too', () => {
    const out = extractFromJsonLd(body(`It&amp;#39;s here. ${pad}`));
    expect(out!.content).toContain("It's here");
  });
});
