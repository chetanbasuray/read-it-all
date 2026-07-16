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

describe('polishArticleForSite for dailymail.co.uk', () => {
  it('strips the Published/Updated timestamp paragraph and the Google-preferred-source bullet', () => {
    const html =
      '<p>Real paragraph one.</p>' +
      '<p><span>Published: 22:37 BST, 15 July 2026</span> | <span>Updated: 22:51 BST, 15 July 2026</span></p>' +
      '<ul><li><strong>See more Daily Mail on Google - <a href="#">save us as a Preferred Source</a></strong></li></ul>' +
      '<p>Real paragraph two.</p>';

    const article = polishArticleForSite(
      fakeArticle({ url: 'https://www.dailymail.co.uk/news/article-1/example.html', content: html }),
    );

    expect(article.content).not.toContain('Published:');
    expect(article.content).not.toContain('Preferred Source');
    expect(article.content).toContain('Real paragraph one.');
    expect(article.content).toContain('Real paragraph two.');
  });

  it('applies the same rule to dailymail.com and dailymail.co.uk', () => {
    const html = '<p>Published: today</p><p>Real.</p>';
    const comArticle = polishArticleForSite(
      fakeArticle({ url: 'https://www.dailymail.com/news/article-1/example.html', content: html }),
    );
    const coUkArticle = polishArticleForSite(
      fakeArticle({ url: 'https://www.dailymail.co.uk/news/article-1/example.html', content: html }),
    );
    expect(comArticle.content).not.toContain('Published:');
    expect(coUkArticle.content).not.toContain('Published:');
  });

  it('leaves content untouched when none of the known junk is present', () => {
    const article = fakeArticle({
      url: 'https://www.dailymail.co.uk/news/article-1/example.html',
      content: '<p>Clean paragraph.</p>',
    });
    expect(polishArticleForSite(article)).toEqual(article);
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
