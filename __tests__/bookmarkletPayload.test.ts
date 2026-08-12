import { describe, it, expect } from 'vitest';
import { extractArticle } from '@/lib/scraper';

// what the bookmarklet now sends: page head metadata plus the article container,
// rather than its own client-side extraction
const prose = '<p>Real article prose long enough for readability to accept this body without complaint.</p>'.repeat(6);
const payload = `<html><head>` +
  `<title>A headline - Defence Security Asia</title>` +
  `<meta property="og:site_name" content="Defence Security Asia">` +
  `<meta property="og:title" content="A headline - Defence Security Asia">` +
  `<meta name="author" content="Jane Doe">` +
  `<meta property="og:image" content="https://example.com/hero.jpg">` +
  `</head><body><article><h1>A headline</h1>${prose}</article></body></html>`;

describe('the head-plus-container payload the bookmarklet sends', () => {
  const article = extractArticle(payload, 'https://defencesecurityasia.com/a')!;

  it('recovers the byline, which the old payload hardcoded empty', () => {
    expect(article.byline).toBe('Jane Doe');
  });

  it('recovers the lead image, which the old payload hardcoded empty', () => {
    expect(article.image).toBe('https://example.com/hero.jpg');
  });

  it('strips the publisher suffix, which needs og:site_name from the head', () => {
    expect(article.title).toBe('A headline');
  });

  it('separates block elements instead of welding sentences together', () => {
    expect(article.textContent).not.toMatch(/[a-z]\.[A-Z][a-z]/);
  });

  it('still extracts when the head carries no metadata at all', () => {
    const bare = `<html><head></head><body><article>${prose}</article></body></html>`;
    expect(extractArticle(bare, 'https://example.com/a')).not.toBeNull();
  });
});
