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

  it('strips the video widget, related-links, tag list, and byline action buttons for bbc.com', () => {
    const html =
      '<html><body>' +
      '<div class="Byline-styles__BylineStyled-sc-1">17 minutes ago' +
      '<div class="Byline-styles__ActionsContainerStyled-sc-2">' +
      '<span>Share</span><span>Save</span></div>' +
      '<div class="Byline-styles__GooglePreferredButtonContainerStyled-sc-3">Add as preferred on Google</div>' +
      '<span class="Byline-styles__AuthorNameStyled-sc-4">Helen Sullivan, BBC News</span></div>' +
      '<figure><div class="PortraitVideoConstraint-sc-5"><div class="CustomCTA-styles__DurationStyled-sc-6">1:26</div>' +
      '<figcaption>Watch: some video caption</figcaption></div></figure>' +
      '<p>Real paragraph.</p>' +
      '<div class="Links-styles__LinksContainerStyled-sc-7"><h2>More on this story</h2></div>' +
      '<div class="TagList-styles__TagListStyled-sc-8"><a href="/topics/x">Some Topic</a></div>' +
      '</body></html>';

    const result = preprocessHtmlForSite('https://www.bbc.com/news/articles/c456', html);

    expect(result).not.toContain('Share');
    expect(result).not.toContain('Add as preferred on Google');
    expect(result).not.toContain('Watch: some video caption');
    expect(result).not.toContain('More on this story');
    expect(result).not.toContain('Some Topic');
    expect(result).toContain('17 minutes ago');
    expect(result).toContain('Helen Sullivan, BBC News');
    expect(result).toContain('Real paragraph.');
  });

  it('strips the match-info card, inline teasers, and tag list on BBC Sport (ssrcss-*) pages', () => {
    const html =
      '<html><body>' +
      '<p>Real paragraph one.</p>' +
      '<div class="ssrcss-yapki9-EventInformationContainer e646wox6">' +
      '<p>Fifa World Cup 2026 semi-final</p></div>' +
      '<ul><li class="ssrcss-qzx51b-LinkItem e3eyuya1">' +
      '<a href="/x"><p>Unrelated headline</p></a></li></ul>' +
      '<p>Real paragraph two.</p>' +
      '<div class="ssrcss-nj9heb-StyledTagContainer ed0g1kj1">' +
      '<h2>Related topics</h2><a href="/topics/football">Football</a></div>' +
      '</body></html>';

    const result = preprocessHtmlForSite('https://www.bbc.com/sport/football/articles/c456', html);

    expect(result).not.toContain('Fifa World Cup 2026 semi-final');
    expect(result).not.toContain('Unrelated headline');
    expect(result).not.toContain('Related topics');
    expect(result).toContain('Real paragraph one.');
    expect(result).toContain('Real paragraph two.');
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

describe('polishArticleForSite for reuters.com', () => {
  const zeroWidthSpace = String.fromCharCode(0x200b);

  it('strips the embedded Read Next widget and ad-slot placeholder', () => {
    const html =
      '<p>Real paragraph one.</p>' +
      '<div class="ad-slot-module__container__VEdre">' +
      '<span>Advertisement &middot; Scroll to continue</span></div>' +
      '<p>Real paragraph two.</p>' +
      '<div class="article-module__read-next__xukaw">' +
      '<h2>Read Next</h2><ul><li>Unrelated headline one</li><li>Unrelated headline two</li></ul>' +
      '</div>';

    const article = polishArticleForSite(
      fakeArticle({ url: 'https://www.reuters.com/world/example-2026-07-14/', content: html }),
    );

    expect(article.content).not.toContain('Read Next');
    expect(article.content).not.toContain('Advertisement');
    expect(article.content).toContain('Real paragraph one.');
    expect(article.content).toContain('Real paragraph two.');
  });

  it('strips invisible zero-width characters from text fields', () => {
    const dirty = `respon${zeroWidthSpace}ded in self${zeroWidthSpace}-defence`;
    const article = polishArticleForSite(
      fakeArticle({
        url: 'https://www.reuters.com/world/example-2026-07-14/',
        textContent: dirty,
        excerpt: dirty,
      }),
    );

    expect(article.textContent).toBe('responded in self-defence');
    expect(article.excerpt).toBe('responded in self-defence');
  });

  it('leaves reuters.com content untouched when it has none of the known junk', () => {
    const article = fakeArticle({
      url: 'https://www.reuters.com/world/example-2026-07-14/',
      content: '<p>Clean paragraph.</p>',
    });
    expect(polishArticleForSite(article)).toEqual(article);
  });
});

describe('polishArticleForSite for theguardian.com', () => {
  it('strips the newsletter-widget skip-link pair, keeping real content around it', () => {
    const html =
      '<p>Real paragraph one.</p>' +
      '<figure><a href="#EmailSignup-skip-link-16">skip past newsletter promotion</a>' +
      '<p id="EmailSignup-skip-link-16" aria-label="after newsletter promotion">after newsletter promotion</p></figure>' +
      '<p>Real paragraph two.</p>';

    const article = polishArticleForSite(
      fakeArticle({ url: 'https://www.theguardian.com/football/2026/jul/15/example', content: html }),
    );

    expect(article.content).not.toContain('skip past');
    expect(article.content).not.toContain('after newsletter promotion');
    expect(article.content).toContain('Real paragraph one.');
    expect(article.content).toContain('Real paragraph two.');
  });

  it('leaves theguardian.com content untouched when it has no skip-link widget', () => {
    const article = fakeArticle({
      url: 'https://www.theguardian.com/football/2026/jul/15/example',
      content: '<p>Clean paragraph.</p>',
    });
    expect(polishArticleForSite(article)).toEqual(article);
  });
});
