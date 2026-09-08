import { describe, it, expect } from 'vitest';
import { declaresPaywalledContent, extractArticle, walledSectionTextLength } from '@/lib/scraper';

// the shape haaretz.com actually serves logged-out visitors: JSON-LD whose
// articleBody is only the opening paragraph (~330 chars), long enough to pass
// the JSON-LD tier's own 200-char minimum and previously get cached as if it
// were the article
const TEASER =
  'These were the final days of September 2023. Attacks inflamed the region, masses of people ' +
  'regularly protested at the border fence, and the country was reeling from internal conflict ' +
  'over the judicial laws. Anyone watching the events with clear eyes could sense that an ' +
  'escalation was lurking around every corner.';

const FULL_BODY =
  'A much longer stretch of genuine reporting follows, with named sources and verifiable detail in every sentence. '.repeat(
    40,
  );

function jsonLd(obj: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

function page(head: string, body: string): string {
  return `<html><head>${head}</head><body>${body}</body></html>`;
}

// mirrors haaretz.com's markup: isAccessibleForFree false on the NewsArticle
// itself plus a hasPart WebPageElement naming the walled section (where the
// flag is the string "false", not a boolean)
function paywalledArticlePage(articleBody: string, domBody = `<p>${articleBody}</p>`): string {
  return page(
    `<meta property="og:title" content="Revealed: an explicit warning">` +
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: 'Revealed: an explicit warning',
        isAccessibleForFree: false,
        articleBody,
        hasPart: {
          '@type': 'WebPageElement',
          isAccessibleForFree: 'false',
          cssSelector: '.article-body-wrapper',
        },
        author: [{ '@type': 'Person', name: 'Reporter One' }],
      }),
    `<div class="article-body-wrapper">${domBody}</div>`,
  );
}

describe('declaresPaywalledContent', () => {
  it('detects a boolean false on the article node', () => {
    const html = page(jsonLd({ '@type': 'NewsArticle', isAccessibleForFree: false }), '');
    expect(declaresPaywalledContent(html)).toBe(true);
  });

  it('detects the string "false" inside a hasPart WebPageElement', () => {
    const html = page(
      jsonLd({
        '@type': 'NewsArticle',
        hasPart: { '@type': 'WebPageElement', isAccessibleForFree: 'false', cssSelector: '.body' },
      }),
      '',
    );
    expect(declaresPaywalledContent(html)).toBe(true);
  });

  it('detects a capitalised "False", which publishers also ship', () => {
    const html = page(jsonLd({ '@type': 'NewsArticle', isAccessibleForFree: 'False' }), '');
    expect(declaresPaywalledContent(html)).toBe(true);
  });

  it('detects the flag on a hasPart array of sections', () => {
    const html = page(
      jsonLd({
        '@type': 'NewsArticle',
        hasPart: [
          { '@type': 'WebPageElement', isAccessibleForFree: 'true', cssSelector: '.free' },
          { '@type': 'WebPageElement', isAccessibleForFree: 'false', cssSelector: '.walled' },
        ],
      }),
      '',
    );
    expect(declaresPaywalledContent(html)).toBe(true);
  });

  it('detects the flag on an item nested under @graph', () => {
    const html = page(
      jsonLd({ '@graph': [{ '@type': 'WebPage' }, { '@type': 'NewsArticle', isAccessibleForFree: false }] }),
      '',
    );
    expect(declaresPaywalledContent(html)).toBe(true);
  });

  it('is not fooled by isAccessibleForFree: true', () => {
    const html = page(jsonLd({ '@type': 'NewsArticle', isAccessibleForFree: true }), '');
    expect(declaresPaywalledContent(html)).toBe(false);
  });

  it('stays false when the markup is absent', () => {
    const html = page(jsonLd({ '@type': 'NewsArticle', headline: 'Free piece' }), '');
    expect(declaresPaywalledContent(html)).toBe(false);
  });

  it('skips an unparseable script and still finds the flag in the next one', () => {
    const html = page(
      `<script type="application/ld+json">{not json</script>` +
        jsonLd({ '@type': 'NewsArticle', isAccessibleForFree: false }),
      '',
    );
    expect(declaresPaywalledContent(html)).toBe(true);
  });
});

describe('extractArticle on a declared-paywall page', () => {
  it('exercises the JSON-LD tier, not its length gate: the teaser passes the 200-char minimum', () => {
    expect(TEASER.length).toBeGreaterThan(200);
  });

  it('refuses to pass a teaser off as the article (the haaretz.com regression)', () => {
    const result = extractArticle(paywalledArticlePage(TEASER), 'https://www.haaretz.com/israel-news/a');
    expect(result).toBeNull();
  });

  it('still accepts a paywall-declared page that ships the full text to crawlers', () => {
    const result = extractArticle(paywalledArticlePage(FULL_BODY), 'https://example.com/cloaked');
    expect(result).not.toBeNull();
    expect(result!.textContent).toContain('genuine reporting');
  });

  it('leaves a short article on a page with no paywall markup alone', () => {
    const html = page(
      jsonLd({ '@type': 'NewsArticle', headline: 'Short brief', articleBody: TEASER }),
      `<p>${TEASER}</p>`,
    );
    const result = extractArticle(html, 'https://example.com/brief');
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Short brief');
  });

  it('falls past the JSON-LD teaser to the full DOM body a subscriber session gets', () => {
    // logged-in pages keep the teaser-length articleBody in JSON-LD while the
    // DOM carries the whole piece; the rejection must be per-candidate so the
    // Readability tier can still win here
    const subscriberDom = `<p>${TEASER}</p>${'<p>Deep reporting paragraph a subscriber can read, full of concrete facts and follow-up questions worth the space they take.</p>'.repeat(15)}`;
    const result = extractArticle(
      paywalledArticlePage(TEASER, subscriberDom),
      'https://www.haaretz.com/israel-news/a',
    );
    expect(result).not.toBeNull();
    expect(result!.textContent).toContain('Deep reporting paragraph a subscriber can read');
  });

  it('is not fooled by page furniture padding a stub past the length threshold', () => {
    // the real logged-out haaretz.com shape: the declared walled section holds
    // only the teaser, but share prompts, topic tags and related-headline lists
    // outside it give Readability well over the threshold to sweep up
    const furniture =
      '<div class="related">' +
      '<p>Article printing is available to subscribers only, in a simple and comfortable format.</p>' +
      '<p>Syria and its neighbours defy expectations and court new allies, risking a collision course.</p>'.repeat(
        14,
      ) +
      '</div>';
    const html = paywalledArticlePage(TEASER, `<p>${TEASER}</p>`).replace(
      '</body>',
      `${furniture}</body>`,
    );
    expect(extractArticle(html, 'https://www.haaretz.com/israel-news/a')).toBeNull();
  });
});

describe('walledSectionTextLength', () => {
  it('measures only the declared section, not the furniture around it', () => {
    const html = `<html><body><div class="walled"><p>${'inside '.repeat(10)}</p></div><div class="related">${'outside '.repeat(100)}</div></body></html>`;
    const length = walledSectionTextLength(html, ['.walled']);
    expect(length).toBeGreaterThan(50);
    expect(length).toBeLessThan(100);
  });

  it('does not count a script inside the section as text', () => {
    const html = `<html><body><div class="walled"><p>short teaser</p><script>${'var x = 1; '.repeat(200)}</script></div></body></html>`;
    expect(walledSectionTextLength(html, ['.walled'])).toBeLessThan(50);
  });

  it('sums multiple declared sections', () => {
    const html = `<html><body><div class="a"><p>${'one '.repeat(20)}</p></div><div class="b"><p>${'two '.repeat(20)}</p></div></body></html>`;
    expect(walledSectionTextLength(html, ['.a', '.b'])).toBeGreaterThan(150);
  });

  it('returns null when the markup names no selector', () => {
    expect(walledSectionTextLength('<html><body></body></html>', [])).toBeNull();
  });

  it('treats a declared selector that matches nothing as an empty section', () => {
    expect(walledSectionTextLength('<html><body><p>x</p></body></html>', ['.gone'])).toBe(0);
  });
});
