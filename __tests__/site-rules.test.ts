import { describe, it, expect } from 'vitest';
import { preprocessHtmlForSite, polishArticleForSite } from '@/lib/site-rules';
import { extractArticle, type ArticleData } from '@/lib/scraper';

function fakeArticle(overrides: Partial<ArticleData> = {}): ArticleData {
  return {
    title: 'Title',
    content: '<p>content</p>',
    textContent: 'content',
    excerpt: 'content',
    byline: null,
    image: null,
    url: 'https://example.com/article',
    ...overrides,
  };
}

// BBC's no-JS nav menu lives inside <noscript>, which HTML parsers treat as opaque
// text (not real DOM elements) when scripting is assumed enabled, matching the real page.
function withNoJsNav(bodyHtml: string): string {
  const navLinks = Array.from(
    { length: 30 },
    (_, i) => `<li><a href="/section-${i}">Section ${i}</a></li>`,
  ).join('');
  return (
    `<html><head><title>Real Headline</title></head><body>` +
    `<noscript><details class="NoJsNavigation-styles__NoJsMenuStyled-sc-abc123-0">` +
    `<summary>Menu</summary><ul>${navLinks}</ul></details></noscript>` +
    bodyHtml +
    `</body></html>`
  );
}

describe('preprocessHtmlForSite', () => {
  it('strips the noscript-wrapped NoJsNavigation block for bbc.com URLs', () => {
    const html = withNoJsNav('<article><p>The real article body.</p></article>');
    const result = preprocessHtmlForSite('https://www.bbc.com/news/articles/c123', html);

    expect(result).not.toContain('<details');
    expect(result).toContain('The real article body.');
  });

  it('matches bbc.co.uk as well as bbc.com', () => {
    const html = withNoJsNav('<p>real</p>');
    const result = preprocessHtmlForSite('https://www.bbc.co.uk/news/articles/c123', html);
    expect(result).not.toContain('<details');
  });

  it('leaves HTML from sites with no registered rule untouched', () => {
    const html = withNoJsNav('<p>real</p>');
    const result = preprocessHtmlForSite('https://example.com/article', html);
    expect(result).toContain('<details');
  });

  it('does not throw on an invalid url', () => {
    expect(() => preprocessHtmlForSite('not a url', '<p>x</p>')).not.toThrow();
  });
});

describe('extractArticle with BBC nav-menu regression', () => {
  it('extracts the real article instead of the no-JS navigation menu', () => {
    const html = withNoJsNav(
      '<article><h1>Real Headline</h1><p>' +
        'This is the real article body with enough substance to be extracted correctly. '.repeat(10) +
        '</p></article>',
    );

    const article = extractArticle(html, 'https://www.bbc.com/news/articles/c123');

    expect(article).not.toBeNull();
    expect(article?.content).not.toContain('NoJsNavigation');
    expect(article?.textContent).toContain('real article body');
  });

  it('reproduces the bug when the site rule is bypassed (sanity check)', () => {
    // same fixture, but hitting a domain with no registered rule, so the noscript
    // nav is left in place: proves the fixture actually exercises the real failure mode
    const html = withNoJsNav(
      '<article><h1>Real Headline</h1><p>' +
        'This is the real article body with enough substance to be extracted correctly. '.repeat(10) +
        '</p></article>',
    );

    const article = extractArticle(html, 'https://example.com/articles/c123');

    expect(article).not.toBeNull();
    expect(article?.content).toContain('NoJsNavigation');
  });
});

describe('polishArticleForSite', () => {
  it('passes the article through unchanged when no rule defines polishArticle', () => {
    const article = fakeArticle({ url: 'https://www.bbc.com/news/articles/c123' });
    expect(polishArticleForSite(article)).toEqual(article);
  });

  it('passes the article through unchanged for sites with no registered rule', () => {
    const article = fakeArticle({ url: 'https://example.com/article' });
    expect(polishArticleForSite(article)).toEqual(article);
  });
});
