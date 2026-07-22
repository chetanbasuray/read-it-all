import { describe, it, expect } from 'vitest';
import { preprocessHtmlForSite, polishArticleForSite, SITE_RULES } from '@/lib/site-rules';
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

describe('every registered preprocessHtml rule preserves <head>', () => {
  // a rule that serializes via $('body').html() instead of $.html() silently
  // discards <head>, breaking og:image/twitter:image/JSON-LD/meta-author
  // extraction downstream; this bug hit 20 site rules at once (found via
  // news18.com's hero image resolving to an unrelated font-preview SVG)
  const headMarker = '<meta property="og:image" content="https://example.com/real-photo.jpg">';
  const rawHtml = `<html><head>${headMarker}</head><body><article><p>Real paragraph.</p></article></body></html>`;

  for (const [domain, rule] of Object.entries(SITE_RULES)) {
    if (!rule.preprocessHtml) continue;
    it(`keeps the og:image meta tag intact for ${domain}`, () => {
      const result = rule.preprocessHtml!(rawHtml);
      expect(result).toContain(headMarker);
    });
  }
});

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

  it('extracts the real article even with no site rule, since the nav-menu noscript text does not read as prose', () => {
    // same fixture, hitting a domain with no registered rule: the noscript-metadata
    // tier's own prose check now rejects a repetitive link list on its own merits
    // (mostly "Section N" labels, not sentences), falling through to Readability
    const html = withNoJsNav(
      '<article><h1>Real Headline</h1><p>' +
        'This is the real article body with enough substance to be extracted correctly. '.repeat(10) +
        '</p></article>',
    );

    const article = extractArticle(html, 'https://example.com/articles/c123');

    expect(article).not.toBeNull();
    expect(article?.content).not.toContain('Section 0');
    expect(article?.textContent).toContain('real article body');
  });
});

describe('extractArticle noscript-metadata tier rejects non-prose content', () => {
  it('falls through to Readability when the noscript block is a lazy-load <style> tag', () => {
    const cssText = '.elementor-813 .elementor-element:not(.type-background){background-position:top}'.repeat(6);
    const html =
      `<html><body><noscript><style>${cssText}</style></noscript>` +
      '<article><h1>Real Headline</h1><p>' +
      'This is the real article body with enough substance to be extracted correctly. '.repeat(10) +
      '</p></article></body></html>';

    const article = extractArticle(html, 'https://example.com/article');

    expect(article).not.toBeNull();
    expect(article?.textContent).toContain('real article body');
  });

  it('falls through to Readability when the noscript block is a lazy-loaded image srcset', () => {
    const srcset = 'https://example.com/img/width/336/photo.webp 336w, https://example.com/img/width/1008/photo.webp 1008w, '.repeat(6);
    const html =
      `<html><body><noscript><img src="https://example.com/img.jpg" srcset="${srcset}"></noscript>` +
      '<article><h1>Real Headline</h1><p>' +
      'This is the real article body with enough substance to be extracted correctly. '.repeat(10) +
      '</p></article></body></html>';

    const article = extractArticle(html, 'https://example.com/article');

    expect(article).not.toBeNull();
    expect(article?.textContent).toContain('real article body');
  });
});

describe('extractArticle noscript-metadata tier sanitizes its output', () => {
  it('strips a live event-handler attribute smuggled in via <noscript> raw text', () => {
    const filler = 'Real paragraph text with enough substance to pass the length threshold. '.repeat(10);
    const html =
      '<html><head><title>Real Headline</title></head><body>' +
      `<noscript><p>${filler}</p><img src="x" onerror="alert(1)"></noscript>` +
      '</body></html>';

    const article = extractArticle(html, 'https://example.com/article');

    expect(article).not.toBeNull();
    expect(article?.content).not.toContain('onerror');
    expect(article?.textContent).toContain('Real paragraph text');
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

  it('strips the trailing "Explore more on these topics" and "Most viewed" modules', () => {
    const html =
      '<div><p>Real paragraph one.</p>' +
      '<p>Real paragraph two.</p>' +
      '<div><span>Explore more on these topics</span>' +
      '<div><ul><li><a href="/technology/uber">Uber</a></li></ul></div>' +
      '<div><a href="mailto:?subject=x">Share</a></div></div></div>' +
      '<div><span><div><div><div><h3>Most viewed</h3>' +
      '<ul><li><a href="/x">Unrelated trending story</a></li></ul>' +
      '</div></div></div></span></div>';

    const article = polishArticleForSite(
      fakeArticle({ url: 'https://www.theguardian.com/technology/2026/jul/16/example', content: html }),
    );

    expect(article.content).not.toContain('Explore more on these topics');
    expect(article.content).not.toContain('Most viewed');
    expect(article.content).not.toContain('Unrelated trending story');
    expect(article.content).toContain('Real paragraph one.');
    expect(article.content).toContain('Real paragraph two.');
  });
});

describe('preprocessHtmlForSite for cnn.com', () => {
  it('strips the header nav, ad-feedback modal, and app-download promo', () => {
    const html =
      '<html><body>' +
      '<div id="ad-feedback__modal-overlay">Your effort and contribution is appreciated.</div>' +
      '<div id="headerSubNav"><a href="/live-tv">Live TV</a><a href="/watch">Watch</a></div>' +
      '<p>Real paragraph one.</p>' +
      '<div><div><h2>Download the CNN app</h2></div>' +
      '<div><p>Scan the QR code to download the CNN app.</p></div></div>' +
      '<p>Real paragraph two.</p>' +
      '</body></html>';

    const result = preprocessHtmlForSite('https://edition.cnn.com/2026/07/14/example', html);

    expect(result).not.toContain('Your effort and contribution');
    expect(result).not.toContain('Live TV');
    expect(result).not.toContain('Download the CNN app');
    expect(result).not.toContain('Scan the QR code');
    expect(result).toContain('Real paragraph one.');
    expect(result).toContain('Real paragraph two.');
  });

  it('applies the same rule to edition.cnn.com and cnn.com', () => {
    const html = '<html><body><div id="headerSubNav">nav</div><p>Real.</p></body></html>';
    expect(preprocessHtmlForSite('https://www.cnn.com/2026/07/14/example', html)).not.toContain('headerSubNav');
    expect(preprocessHtmlForSite('https://edition.cnn.com/2026/07/14/example', html)).not.toContain('headerSubNav');
  });
});

describe('preprocessHtmlForSite for timesofindia.indiatimes.com', () => {
  const url = 'https://timesofindia.indiatimes.com/india/example/articleshow/1.cms';

  it('turns paragraph-break spans into real breaks and drops the JSON-LD script', () => {
    const html =
      '<html><body><script type="application/ld+json">{"articleBody":"no paragraph markers at all"}</script>' +
      '<div>First sentence.<span class="id-r-component br" data-pos="2"></span>Second sentence.</div>' +
      '</body></html>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('id-r-component');
    expect(result).not.toContain('application/ld+json');
    expect(result).toContain('First sentence.<br><br>Second sentence.');
  });

  it('strips the sng.link app-download promo, Taboola/mgid widgets, and poll wrapper', () => {
    const html =
      '<html><body>' +
      '<p>Real paragraph.</p>' +
      '<div class="cdatainfo"><a href="https://timesofindia.sng.link/x">Get the latest India news and live updates. Download the TOI App.</a></div>' +
      '<div class="cdatainfo"><h3>A real subheading</h3></div>' +
      '<div id="taboola-mid-article-thumbnails-1" class="wdt-taboola">junk</div>' +
      '<div class="mgid_second_mrec_parent">junk</div>' +
      '<div class="sQLTU timeline_pollWrapper_as">Poll junk</div>' +
      '</body></html>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Download the TOI');
    expect(result).not.toContain('junk');
    expect(result).toContain('Real paragraph.');
    expect(result).toContain('A real subheading');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const html = '<html><body><p>Clean paragraph.</p></body></html>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('polishArticleForSite for timesofindia.indiatimes.com', () => {
  const url = 'https://timesofindia.indiatimes.com/india/example/articleshow/1.cms';

  it('strips the publication and timestamp bundled into the byline', () => {
    const article = polishArticleForSite(
      fakeArticle({ url, byline: 'TOI News Desk / TIMESOFINDIA.COM /  Jul 15, 2026, 12:46 IST' }),
    );
    expect(article.byline).toBe('TOI News Desk');
  });

  it('leaves a byline with no publication/timestamp suffix untouched', () => {
    const article = polishArticleForSite(fakeArticle({ url, byline: 'TOI News Desk' }));
    expect(article.byline).toBe('TOI News Desk');
  });

  it('leaves a null byline untouched', () => {
    const article = polishArticleForSite(fakeArticle({ url, byline: null }));
    expect(article.byline).toBeNull();
  });
});

describe('preprocessHtmlForSite for timesofisrael.com', () => {
  const url = 'https://www.timesofisrael.com/example-article/';

  it('strips the sibling date/edit spans from the byline wrapper, keeping the byline text', () => {
    const html =
      '<html><body><div class="wrap-byline">' +
      '<span class="byline">By <a href="/writers/toi-staff/">ToI Staff</a></span>' +
      '<span class="date">Today, 10:04 am</span>' +
      '<span class="edit empty"><a href="/wp-admin">Edit</a></span>' +
      '</div><p>Real paragraph.</p></body></html>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Today, 10:04 am');
    expect(result).not.toContain('Edit');
    expect(result).toContain('ToI Staff');
    expect(result).toContain('Real paragraph.');
  });

  it('strips the inline newsletter-signup widget', () => {
    const html =
      '<html><body>' +
      '<p>Real paragraph one.</p>' +
      '<div class="newsletter newsletter-article" data-website="timesofisrael">' +
      '<div class="newsletter-article-text"><span>Get The Times of Israel&#39;s Daily Edition</span></div>' +
      '<div class="newsletter-article-terms">By signing up, you agree to the terms</div>' +
      '</div>' +
      '<p>Real paragraph two.</p>' +
      '</body></html>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Daily Edition');
    expect(result).not.toContain('agree to the terms');
    expect(result).toContain('Real paragraph one.');
    expect(result).toContain('Real paragraph two.');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const html = '<html><body><p>Clean paragraph.</p></body></html>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('polishArticleForSite for timesofisrael.com', () => {
  const url = 'https://www.timesofisrael.com/example-article/';

  it('strips the leading "By " prefix, since the reader UI adds its own', () => {
    const article = polishArticleForSite(fakeArticle({ url, byline: 'By ToI Staff' }));
    expect(article.byline).toBe('ToI Staff');
  });

  it('leaves a byline with no "By " prefix untouched', () => {
    const article = polishArticleForSite(fakeArticle({ url, byline: 'ToI Staff' }));
    expect(article.byline).toBe('ToI Staff');
  });

  it('leaves a null byline untouched', () => {
    const article = polishArticleForSite(fakeArticle({ url, byline: null }));
    expect(article.byline).toBeNull();
  });
});

describe('preprocessHtmlForSite for bylinetimes.com', () => {
  const url = 'https://bylinetimes.com/2026/07/09/example-article/';

  it('strips a <noscript> lazy-load image fallback long enough to fool the noscript-extraction fallback tier', () => {
    const longAttrString = 'x'.repeat(600);
    const html =
      `<html><body><noscript><img src="/image.jpg" data-srcset="${longAttrString}"></noscript>` +
      '<article><h1>Real headline</h1><p>' +
      'This is the real article body with enough substance to be extracted correctly. '.repeat(10) +
      '</p></article></body></html>';

    const result = extractArticle(html, url);

    expect(result).not.toBeNull();
    expect(result?.textContent).toContain('real article body');
  });

  it('strips the magazine-subscription promo block by its heading, keeping real content around it', () => {
    const html =
      '<html><body>' +
      '<div class="wp-block-post-author-name"><a href="/author/x">Real Author</a></div>' +
      '<div class="wp-block-columns alignfull">' +
      '<h2 id="h-read-our-monthly-magazine">Read our Monthly Magazine</h2>' +
      '<h3>And support our mission to provide fearless stories</h3>' +
      '<a href="https://subscribe.bylinetimes.com/">Support Our Mission</a>' +
      '</div>' +
      '<p>Real paragraph one.</p>' +
      '<p>Real paragraph two.</p>' +
      '</body></html>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Monthly Magazine');
    expect(result).not.toContain('Support Our Mission');
    expect(result).toContain('Real paragraph one.');
    expect(result).toContain('Real paragraph two.');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const html = '<html><body><p>Clean paragraph.</p></body></html>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('preprocessHtmlForSite for pcmag.com', () => {
  const url = 'https://www.pcmag.com/news/example-article';

  it('marks the real byline link so the generic author selector finds it', () => {
    const html =
      '<html><body><p>Real paragraph.</p>' +
      '<div id="author-byline"><span class="font-semibold">By ' +
      '<a data-element="author-name" href="/authors/jane-doe">Jane Doe</a></span>' +
      '<span>July 14, 2026</span></div>' +
      '</body></html>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).toContain('byline-marker');
  });

  it('strips the related-stories, author-bio, and dig-deeper widgets', () => {
    const html =
      '<html><body>' +
      '<p>Real paragraph one.</p>' +
      '<div data-parent-group="related-stories"><h3>Recommended by Our Editors</h3></div>' +
      '<section data-parent-group="author-bio"><h2>About Our Expert</h2></section>' +
      '<p>Real paragraph two.</p>' +
      '<div data-parent-group="dig-deeper"><h3>Weekend Project</h3></div>' +
      '</body></html>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Recommended by Our Editors');
    expect(result).not.toContain('About Our Expert');
    expect(result).not.toContain('Weekend Project');
    expect(result).toContain('Real paragraph one.');
    expect(result).toContain('Real paragraph two.');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const html = '<html><body><p>Clean paragraph.</p></body></html>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('preprocessHtmlForSite for dailymail.co.uk', () => {
  it('strips the byline-section timestamp block and the Google-preferred-source bullet', () => {
    const html =
      '<p>Real paragraph one.</p>' +
      '<p class="byline-section"><span>Published: 22:37 BST, 15 July 2026</span> | <span>Updated: 22:51 BST, 15 July 2026</span></p>' +
      '<ul><li><strong>See more Daily Mail on Google - <a href="#">save us as a Preferred Source</a></strong></li></ul>' +
      '<p>Real paragraph two.</p>';

    const result = preprocessHtmlForSite('https://www.dailymail.co.uk/news/article-1/example.html', html);

    expect(result).not.toContain('Published:');
    expect(result).not.toContain('Preferred Source');
    expect(result).toContain('Real paragraph one.');
    expect(result).toContain('Real paragraph two.');
  });

  it('applies the same rule to dailymail.com and dailymail.co.uk', () => {
    const html = '<p class="byline-section">Published: today</p><p>Real.</p>';
    const comResult = preprocessHtmlForSite('https://www.dailymail.com/news/article-1/example.html', html);
    const coUkResult = preprocessHtmlForSite('https://www.dailymail.co.uk/news/article-1/example.html', html);
    expect(comResult).not.toContain('Published:');
    expect(coUkResult).not.toContain('Published:');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite('https://www.dailymail.co.uk/news/article-1/example.html', html)).toContain(
      'Clean paragraph.',
    );
  });
});

describe('polishArticleForSite for theverge.com', () => {
  const url = 'https://www.theverge.com/tech/1/example';

  it('strips follow-topic breadcrumb/footer tags but keeps the byline name', () => {
    const html =
      '<span><ul><li><div id="follow-category-breadcrumb-1"><span>Tech</span>' +
      '<div><p>Posts from this topic will be added to your daily email digest and your homepage feed.</p>' +
      '<span>Follow</span></div></div></li></ul></span>' +
      '<h1>Real headline</h1>' +
      '<span aria-haspopup="true"><span id="follow-author-author_byline_lead-1"><span>Real Author</span></span>' +
      '<div><p>Posts from this author will be added to your daily email digest and your homepage feed.</p>' +
      '<span>Follow</span></div></span>' +
      '<p>Real paragraph.</p>' +
      '<li><div id="follow-category-article_footer-1"><span>Tech</span></div></li>';

    const article = polishArticleForSite(fakeArticle({ url, content: html }));

    expect(article.content).not.toContain('Posts from this topic');
    expect(article.content).not.toContain('Posts from this author');
    expect(article.content).not.toContain('>Tech<');
    expect(article.content).toContain('Real headline');
    expect(article.content).toContain('Real Author');
    expect(article.content).toContain('Real paragraph.');
  });

  it('strips everything from the layout rail onward (ads, related stories, newsletter)', () => {
    const html =
      '<p>Real paragraph.</p>' +
      '<div class="duet--layout--rail noh1q10"><div class="m-ad">ad</div>' +
      '<ol><li>Unrelated related story</li></ol>' +
      '<div class="duet--cta--newsletter">Sign Up</div></div>';

    const article = polishArticleForSite(fakeArticle({ url, content: html }));

    expect(article.content).not.toContain('Unrelated related story');
    expect(article.content).not.toContain('Sign Up');
    expect(article.content).toContain('Real paragraph.');
  });

  it('strips the closing "Follow topics and authors" nag', () => {
    const html =
      '<p>Real paragraph.</p>' +
      '<div><span><strong>Follow topics and authors</strong> from this story to see more like this.</span></div>';

    const article = polishArticleForSite(fakeArticle({ url, content: html }));

    expect(article.content).not.toContain('Follow topics and authors');
    expect(article.content).toContain('Real paragraph.');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const article = fakeArticle({ url, content: '<p>Clean paragraph.</p>' });
    expect(polishArticleForSite(article)).toEqual(article);
  });
});

describe('preprocessHtmlForSite for thehindu.com', () => {
  const url = 'https://www.thehindu.com/news/national/example/article1.ece';

  it('strips the site-wide login/subscription slide-out', () => {
    const html =
      '<div class="comments-chat-side-menu"><p class="status">You are logged in</p>' +
      '<p>You don\'t have any Active Subscription.</p></div>' +
      '<p>Real paragraph one.</p>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('You are logged in');
    expect(result).not.toContain('Active Subscription');
    expect(result).toContain('Real paragraph one.');
  });

  it('leaves content untouched when the widget is absent', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('preprocessHtmlForSite for moneycontrol.com', () => {
  const url = 'https://www.moneycontrol.com/world/example-article-1.html';

  it('strips the global header and its hidden mega-menus', () => {
    const html =
      '<header id="common_header"><div class="mega_menu investNW">' +
      '<span class="tit-txt1">Invest in Top Unlisted</span>' +
      '<p class="tit-txt2">Discover the secret world of unlisted shares</p></div></header>' +
      '<div id="article-1"><p>Real paragraph one.</p></div>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Invest in Top Unlisted');
    expect(result).not.toContain('Discover the secret world');
    expect(result).toContain('Real paragraph one.');
  });
});

describe('preprocessHtmlForSite for yahoo.com', () => {
  const url = 'https://www.yahoo.com/news/world/articles/example-1.html';

  it('strips the follow button and "Add Yahoo as a preferred source" widgets', () => {
    const html =
      '<button data-ylk="elm:intent-follow;slk:Follow;" disabled><span>Follow</span></button>' +
      '<a aria-label="Add Yahoo on Google" href="https://www.google.com/preferences/source?q=yahoo.com">Add</a>' +
      '<div role="tooltip">Add Yahoo as a preferred source to see more of our stories on Google.</div>' +
      '<p>Real paragraph one.</p>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('preferred source');
    expect(result).not.toContain('Add Yahoo on Google');
    expect(result).toContain('Real paragraph one.');
  });
});

describe('preprocessHtmlForSite for techspot.com', () => {
  const url = 'https://www.techspot.com/news/example-1.html';

  it('strips the category-tag breadcrumb and the trust tagline', () => {
    const html =
      '<ul class="category-chicklets"><li class="ai"><a href="/category/ai/">AI</a></li></ul>' +
      '<div class="trust-feat news">Serving tech enthusiasts for over 25 years.</div>' +
      '<div class="articleBody"><p>Real paragraph one.</p></div>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('category-chicklets');
    expect(result).not.toContain('Serving tech enthusiasts');
    expect(result).toContain('Real paragraph one.');
  });
});

describe('preprocessHtmlForSite for pravda.com.ua', () => {
  const url = 'https://www.pravda.com.ua/eng/news/2026/07/16/example/';

  it('strips the share widget, mid-article ads, and the related-news aside', () => {
    const html =
      '<article class="post_news"><div class="post_news_body">' +
      '<aside class="post_news_service"><div class="tooltip">Посилання скопійовано</div></aside>' +
      '<div class="post_news_text"><p>Real paragraph one.</p>' +
      '<div class="advtext_mob">Advertisement:</div>' +
      '<p>Real paragraph two.</p></div>' +
      '<div class="unit_side_banner"><div class="nts-ad"></div></div></div>' +
      '<aside class="section_other_news"><div class="section_title">Top news of today</div></aside>' +
      '</article>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Посилання скопійовано');
    expect(result).not.toContain('Advertisement:');
    expect(result).not.toContain('Top news of today');
    expect(result).toContain('Real paragraph one.');
    expect(result).toContain('Real paragraph two.');
  });
});

describe('preprocessHtmlForSite for dw.com', () => {
  const url = 'https://www.dw.com/de/example/a-1';

  it('strips the category kicker, the duplicate numeric date, and the feedback CTA', () => {
    const html =
      '<header><div data-tracking-name="content-detail-kicker"><span>Politik</span><span>Deutschland</span></div>' +
      '<h1>Real headline</h1></header>' +
      '<span class="publication"><time aria-hidden="true">15.07.2026</time><span>15. Juli 2026</span></span>' +
      '<p>Real paragraph one.</p>' +
      '<footer class="c1jc41xr"><div class="feedback"><div role="button" data-tracking-name="feedback-button">Schicken Sie uns Ihr Feedback!</div></div></footer>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('content-detail-kicker');
    expect(result).not.toContain('15.07.2026');
    expect(result).toContain('15. Juli 2026');
    expect(result).not.toContain('Schicken Sie uns');
    expect(result).toContain('Real headline');
    expect(result).toContain('Real paragraph one.');
  });
});

describe('preprocessHtmlForSite for rte.ie', () => {
  const url = 'https://www.rte.ie/news/ireland/2026/0716/example/';

  it('strips the "more stories on" tags footer and the sidebar', () => {
    const html =
      '<p>Real paragraph one.</p>' +
      '<div class="tags-container"><h4>More stories on</h4></div>' +
      '<aside id="sidebar_outer"><div class="ajaxed-content">Most Read</div></aside>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('More stories on');
    expect(result).not.toContain('Most Read');
    expect(result).toContain('Real paragraph one.');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('preprocessHtmlForSite for arstechnica.com', () => {
  const url = 'https://arstechnica.com/gaming/2026/07/example/';

  it('strips PhotoSwipe gallery captions (the hidden lightbox one and the visible inline one)', () => {
    const html =
      '<p>Real paragraph one.</p>' +
      '<div class="pswp-caption-content" id="caption-1">Hidden lightbox caption<div class="ars-gallery-caption-credit">Kyle Orland</div></div>' +
      '<div class="ars-gallery-caption-content"><span class="ars-gallery-caption-text">It\'s true: No devs would mean no games.</span>' +
      '<span class="ars-gallery-caption-credit">Kyle Orland</span></div>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('No devs would mean no games');
    expect(result).not.toContain('Hidden lightbox caption');
    expect(result).toContain('Real paragraph one.');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('preprocessHtmlForSite for eurogamer.net', () => {
  const url = 'https://www.eurogamer.net/example-article';

  it('strips the breadcrumb nav, the "Preferred Source" CTA, and lazy-load noscript image fallbacks', () => {
    const html =
      '<div class="breadcrumbs"><nav data-component="nav-breadcrumbs"><ul><li><a href="/">Home</a></li></ul></nav></div>' +
      '<h1>Real headline</h1>' +
      '<noscript><img src="/image.jpg" alt="' + 'x'.repeat(600) + '"></noscript>' +
      '<p>Real paragraph one.</p>' +
      '<div data-component="preferred-source">Love Eurogamer.net? Make us a Preferred Source on Google.</div>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('nav-breadcrumbs');
    expect(result).not.toContain('Preferred Source on Google');
    expect(result).not.toContain('noscript');
    expect(result).toContain('Real headline');
    expect(result).toContain('Real paragraph one.');
  });
});

describe('preprocessHtmlForSite for dexerto.com', () => {
  const url = 'https://www.dexerto.com/gaming/example-article/';

  it('strips the "Trending" rail and every <aside> (in-body ads, featured articles, signup)', () => {
    const html =
      '<nav><h2>Trending</h2><ul><li><a href="/gta/">GTA 6</a></li></ul></nav>' +
      '<h1>Real headline</h1>' +
      '<p>Real paragraph one.</p>' +
      '<aside><div>Article continues after ad</div></aside>' +
      '<p>Real paragraph two.</p>' +
      '<aside><h2>Featured Articles</h2><span>Sign up to Dexerto</span></aside>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Trending');
    expect(result).not.toContain('Featured Articles');
    expect(result).not.toContain('Sign up to Dexerto');
    expect(result).toContain('Real headline');
    expect(result).toContain('Real paragraph one.');
    expect(result).toContain('Real paragraph two.');
  });
});

describe('preprocessHtmlForSite for cnbc.com', () => {
  const url = 'https://www.cnbc.com/2026/07/17/example-article.html';

  it('strips the article header, the Google-preferred-source CTA, and the watch-live rail', () => {
    const html =
      '<div id="main-article-header"><span>Tech</span><a>Kai Nicol-Schwarz</a><a href="/live-tv/">WATCH LIVE</a></div>' +
      '<p>Real paragraph one.</p>' +
      '<div data-module="GooglePreferredSource">Choose CNBC as your preferred source on Google.</div>' +
      '<div id="RegularArticle-WatchLiveRightRail-8"><a href="/live-tv/">WATCH LIVESTREAM</a></div>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('WATCH LIVE');
    expect(result).not.toContain('preferred source on Google');
    expect(result).not.toContain('WATCH LIVESTREAM');
    expect(result).toContain('Real paragraph one.');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('site rules for ign.com', () => {
  const url = 'https://www.ign.com/articles/example-article';

  it('strips the "Preferred Sources" button, the IGN Recommends module, and the object-summary embed', () => {
    const html =
      '<h1>Real headline</h1>' +
      '<p>Real paragraph one.</p>' +
      '<div class="preferred-source">Get IGN Biggest Stories FIRST. Set Us as Your Source. Add Source</div>' +
      '<div class="ign-recommends"><h3>Recommends</h3><span>Some other article</span></div>' +
      '<div><h3 data-cy="object-summary-embed-title">In This Article</h3><span>Xbox</span></div>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Set Us as Your Source');
    expect(result).not.toContain('Recommends');
    expect(result).not.toContain('In This Article');
    expect(result).toContain('Real headline');
    expect(result).toContain('Real paragraph one.');
  });

  it('cleans a Readability byline that glued a name to an "Updated:" timestamp with no separator', () => {
    const article = polishArticleForSite(
      fakeArticle({ url, byline: 'By Virginia GlazeUpdated: Jul 16, 2026 9:11pm UTC38 comments' }),
    );
    expect(article.byline).toBe('By Virginia Glaze');
  });

  it('leaves an already-clean byline untouched', () => {
    const article = polishArticleForSite(fakeArticle({ url, byline: 'By Virginia Glaze' }));
    expect(article.byline).toBe('By Virginia Glaze');
  });

  it('leaves a null byline untouched', () => {
    const article = polishArticleForSite(fakeArticle({ url, byline: null }));
    expect(article.byline).toBeNull();
  });
});

describe('polishArticleForSite for insideevs.com', () => {
  const url = 'https://insideevs.com/news/example-article/';

  it('strips a trailing "Related Articles" paragraph baked into the JSON-LD articleBody text', () => {
    const html =
      '<p>Real paragraph one.</p>' +
      '<p>Contact the author: someone@insideevs.com.</p>' +
      '<p> Related Articles                      Some Other Headline                      Another Headline</p>';

    const article = polishArticleForSite(fakeArticle({ url, content: html }));

    expect(article.content).not.toContain('Related Articles');
    expect(article.content).not.toContain('Some Other Headline');
    expect(article.content).toContain('Real paragraph one.');
    expect(article.content).toContain('Contact the author');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const article = fakeArticle({ url, content: '<p>Clean paragraph.</p>' });
    expect(polishArticleForSite(article)).toEqual(article);
  });
});

describe('preprocessHtmlForSite for i24news.tv', () => {
  const url = 'https://www.i24news.tv/en/news/international/example-article';

  it('strips the jump-to-comments teaser and the comments section', () => {
    const html =
      '<html><body>' +
      '<article><p>Real paragraph one.</p></article>' +
      '<div class="jump-to-comments">Jump to Comments</div>' +
      '<div id="article-comments">Comments go here</div>' +
      '</body></html>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Jump to Comments');
    expect(result).not.toContain('Comments go here');
    expect(result).toContain('Real paragraph one.');
  });

  it('leaves content untouched when neither widget is present', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('preprocessHtmlForSite for fortune.com', () => {
  const url = 'https://fortune.com/2026/07/17/example-article/';

  it('strips the subscriptionPlea widget by its data-cy test id', () => {
    const html =
      '<p>Real paragraph one.</p>' +
      '<div data-cy="subscriptionPlea"><h3>Sign up for the CEO Daily newsletter</h3></div>' +
      '<p>Real paragraph two.</p>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('CEO Daily newsletter');
    expect(result).toContain('Real paragraph one.');
    expect(result).toContain('Real paragraph two.');
  });

  it('leaves content untouched when no subscription widget is present', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('preprocessHtmlForSite for kyivpost.com', () => {
  const url = 'https://www.kyivpost.com/post/example-article';

  it('strips the Instaread TTS player and the prev/next paging block', () => {
    const html =
      '<html><body>' +
      '<div class="instaread-player-slot">Listen to this article</div>' +
      '<article><p>Real paragraph one.</p></article>' +
      '<div class="paging-block"><a href="/post/prev">Previous</a><a href="/post/next">Next</a></div>' +
      '</body></html>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Listen to this article');
    expect(result).not.toContain('Previous');
    expect(result).toContain('Real paragraph one.');
  });

  it('leaves content untouched when neither widget is present', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('preprocessHtmlForSite for heise.de', () => {
  const url = 'https://www.heise.de/news/Example-Article-1234567.html';

  it('strips the "Share this article" social widget by its article-sharing class', () => {
    const html =
      '<p>Real paragraph one.</p>' +
      '<div class="article-sharing article-footer__sharing"><h3>Share this article</h3>' +
      '<ul><li><a href="https://facebook.com/share">Facebook</a></li></ul>' +
      '<p>Shortlink: https://heise.de/-1234567</p></div>' +
      '<p>Real paragraph two.</p>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Share this article');
    expect(result).not.toContain('Shortlink');
    expect(result).toContain('Real paragraph one.');
    expect(result).toContain('Real paragraph two.');
  });

  it('leaves content untouched when the widget is absent', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('preprocessHtmlForSite for spiegel.de', () => {
  const url = 'https://www.spiegel.de/politik/deutschland/example-article-a-1234567.html';

  it('strips the debate CTA, related-articles block, footer, and trailing author-credit sibling', () => {
    const html =
      '<div data-sara-click-el="body_element"><div data-area="debate"><h3>Diskutieren Sie mit</h3></div></div>' +
      '<div data-area="body"><p>Real paragraph one.</p><p>Real paragraph two.</p></div>' +
      '<p>aeh/fhi</p>' +
      '<div data-area="related_articles"><h2>Mehr zum Thema</h2></div>' +
      '<footer data-area="article-footer"><p>Impressum 2026</p></footer>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Diskutieren Sie mit');
    expect(result).not.toContain('aeh/fhi');
    expect(result).not.toContain('Mehr zum Thema');
    expect(result).not.toContain('Impressum 2026');
    expect(result).toContain('Real paragraph one.');
    expect(result).toContain('Real paragraph two.');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const html = '<div data-area="body"><p>Clean paragraph.</p></div>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('preprocessHtmlForSite for mashable.com', () => {
  const url = 'https://mashable.com/article/example-article';

  it('strips the "Home > Category" breadcrumb section, keeping the headline intact', () => {
    const html =
      '<header><section><a aria-label="Navigate to the Home page" href="/">Home</a>' +
      '<a href="/tech">Tech Section Breadcrumb</a></section>' +
      '<h1>Real headline</h1></header>' +
      '<p>Real paragraph one.</p>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Tech Section Breadcrumb');
    expect(result).toContain('Real headline');
    expect(result).toContain('Real paragraph one.');
  });

  it('leaves content untouched when the breadcrumb is absent', () => {
    const html = '<h1>Real headline</h1><p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('preprocessHtmlForSite for indianexpress.com', () => {
  const url = 'https://indianexpress.com/article/india/example-article-1234567/';

  it('strips the breadcrumb duplicate-headline leak, live-blog rightpanel, and commenting widget', () => {
    const html =
      '<div id="ie-breadcrumb"><a href="/">Home</a><span>Real headline duplicate text</span></div>' +
      '<p>Real paragraph one.</p>' +
      '<div class="rightpanel"><h3>Live Blog</h3></div>' +
      '<div class="ie-network-commenting"><span>Post a comment</span></div>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Real headline duplicate text');
    expect(result).not.toContain('Live Blog');
    expect(result).not.toContain('Post a comment');
    expect(result).toContain('Real paragraph one.');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('polishArticleForSite for indianexpress.com', () => {
  const url = 'https://indianexpress.com/article/india/example-article-1234567/';

  it('strips the "Written by:" prefix and everything from the "N min read" badge onward', () => {
    const article = polishArticleForSite(
      fakeArticle({ url, byline: 'Written by: Jane Doe 4 min read Updated: July 17, 2026 10:00 IST' }),
    );
    expect(article.byline).toBe('Jane Doe');
  });

  it('leaves a byline with no reading-time badge untouched', () => {
    const article = polishArticleForSite(fakeArticle({ url, byline: 'Jane Doe' }));
    expect(article.byline).toBe('Jane Doe');
  });

  it('leaves a null byline untouched', () => {
    const article = polishArticleForSite(fakeArticle({ url, byline: null }));
    expect(article.byline).toBeNull();
  });
});

describe('preprocessHtmlForSite for thenationaldesk.com', () => {
  const url = 'https://thenationaldesk.com/news/example-article';

  it('strips the "TOPICS:" tag-list by finding its marker paragraph and removing the enclosing list', () => {
    const html =
      '<ul><li><p>TOPICS:</p></li><li><a href="/tag/politics">Politics</a></li></ul>' +
      '<p>Real paragraph one.</p>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('TOPICS:');
    expect(result).not.toContain('Politics');
    expect(result).toContain('Real paragraph one.');
  });

  it('leaves content untouched when the tag list is absent', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('polishArticleForSite for thenationaldesk.com', () => {
  const url = 'https://thenationaldesk.com/news/example-article';

  it('splits the outlet-name/weekday boundary glued together by Readability and drops the timestamp', () => {
    const article = polishArticleForSite(
      fakeArticle({ url, byline: 'John SmithFri, July 17th, 2026 3:00 PM EDT' }),
    );
    expect(article.byline).toBe('John Smith');
  });

  it('leaves a byline with no glued weekday untouched', () => {
    const article = polishArticleForSite(fakeArticle({ url, byline: 'John Smith' }));
    expect(article.byline).toBe('John Smith');
  });

  it('leaves a null byline untouched', () => {
    const article = polishArticleForSite(fakeArticle({ url, byline: null }));
    expect(article.byline).toBeNull();
  });
});

describe('preprocessHtmlForSite for newindianexpress.com', () => {
  const url = 'https://www.newindianexpress.com/states/example-article';

  it('strips the empty ad-slot placeholder matched by data-test-id and the app-ad class', () => {
    const html =
      '<p>Real paragraph one.</p>' +
      '<div data-test-id="widget" class="app-ad">Advertisement placeholder</div>' +
      '<p>Real paragraph two.</p>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Advertisement placeholder');
    expect(result).toContain('Real paragraph one.');
    expect(result).toContain('Real paragraph two.');
  });

  it('leaves content untouched when the ad-slot placeholder is absent', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('preprocessHtmlForSite for news18.com', () => {
  const url = 'https://www.news18.com/india/example-article-1234567.html';

  it('strips the Coral comments widget, read-more button, author-bio card, breadcrumb, and Location line', () => {
    const html =
      '<div class="brdcrmb"><a href="/">Home</a><a href="/india">India News Breadcrumb</a></div>' +
      '<p>Real paragraph one.</p>' +
      '<div id="coral-wrap">Loading comments...</div>' +
      '<div id="readmore_story-123"><a href="#">Read More</a></div>' +
      '<div class="atawrap"><h3>About the Author</h3><p>Jane Doe writes about politics.</p></div>' +
      '<p class="atbtlink Location">Location: New Delhi, India</p>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('India News Breadcrumb');
    expect(result).not.toContain('Loading comments');
    expect(result).not.toContain('Read More');
    expect(result).not.toContain('About the Author');
    expect(result).not.toContain('Location: New Delhi');
    expect(result).toContain('Real paragraph one.');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});

describe('preprocessHtmlForSite for hartpunkt.de', () => {
  const url = 'https://www.hartpunkt.de/example-article/';

  it('strips numbered "Anzeige" ad slots by their label text, keeping real content around them', () => {
    const html =
      '<p>Real paragraph one.</p>' +
      '<div class="g g-1"><div class="g-single a-409">' +
      '<span style="font-size:10px">Anzeige</span><br/>' +
      '<a href="https://example-advertiser.com">Sponsored content headline</a>' +
      '</div></div>' +
      '<p>Real paragraph two.</p>';

    const result = preprocessHtmlForSite(url, html);

    expect(result).not.toContain('Anzeige');
    expect(result).not.toContain('Sponsored content headline');
    expect(result).toContain('Real paragraph one.');
    expect(result).toContain('Real paragraph two.');
  });

  it('leaves content untouched when no ad slot is present', () => {
    const html = '<p>Clean paragraph.</p>';
    expect(preprocessHtmlForSite(url, html)).toContain('Clean paragraph.');
  });
});
