import { describe, it, expect } from 'vitest';
import { extractArticle, extractAuthor, extractTitle } from '@/lib/scraper';

const PARAGRAPH =
  'Der Bundeskanzler fährt nach eigenen Worten regelmäßig mit der S-Bahn und nimmt auf dem Weg ins Kanzleramt einen kleinen Umweg durch das Brandenburger Tor in Kauf.';

function prose(count: number, sentence = PARAGRAPH): string {
  return Array.from({ length: count }, (_, i) => `<p>${sentence} Absatz ${i + 1}.</p>`).join('');
}

function ntvPage(): string {
  return `<html><head>
<meta property="og:site_name" content="n-tv.de">
<meta property="og:title" content="Merz schwärmt von morgendlichen S-Bahn-Fahrten in Berlin">
<meta name="author" content="n-tv NACHRICHTEN">
<meta property="og:image" content="https://www.n-tv.de/img/31318810/1789677734/Img_16_9/1200/612869906.jpg">
<script type="application/ld+json">${JSON.stringify({
    // Readability only reads JSON-LD carrying a schema.org @context, which is
    // what makes it prefer this kicker-joined headline over og:title
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: '"Ich mag das hin und wieder" : Merz schwärmt von morgendlichen S-Bahn-Fahrten in Berlin',
    author: { '@type': 'Organization', name: 'n-tv NACHRICHTEN' },
    publisher: { '@type': 'Organization', name: 'ntv NACHRICHTEN' },
  })}</script>
</head><body><article>
<div class="article-detail-head_head__EWZfF"><div class="article-detail-head_wrapper__x2bgp">
<h2 class="article-detail-head_headlines__wHL5h"><span>"Ich mag das hin und wieder" </span><span class="article-detail-head_headline__LjYky">Merz schwärmt von morgendlichen S-Bahn-Fahrten in Berlin</span></h2>
<div class="article-detail-head_infos__SyRrW"><span>17.09.2026, 20:38 Uhr</span><button class="article-detail-head_audio__n5Wq8"><span>Artikel anhören</span></button></div>
<div class="AudioPlayer_audio__d6nzL AudioPlayer_hide__MV8FG"><span>00:00</span>/<span>02:32</span></div>
</div></div>
<div class="wrapper-article">
<figure><img src="https://www.n-tv.de/img/31318810/1789677734/Img_16_9/1024/612869906.webp" alt="612869906"><figcaption>Am Berliner S-Bahnhof Brandenburger Tor steigt der Kanzler aus. (Foto: picture alliance)</figcaption></figure>
${prose(6)}
<p class="article-detail-footer_source__KslPc">Quelle: ntv.de, uzh/dpa</p>
</div></article></body></html>`;
}

const NTV_URL = 'https://www.n-tv.de/politik/Merz-schwaermt-von-morgendlichen-S-Bahn-Fahrten-in-Berlin-id31318732.html';

function golemPage(closingParagraph: string): string {
  return `<html><head>
<meta name="application-name" content="Golem.de">
<meta name="twitter:title" property="og:title" content="EU: China soll Exporte von Hybridautos freiwillig reduzieren - Golem.de">
<meta name="twitter:image" property="og:image" content="https://www.golem.de/2609/213146-598937-598934.jpg">
<meta name="author" content="Tobias Költzsch">
<title>EU: China soll Exporte von Hybridautos freiwillig reduzieren - Golem.de</title>
<script type="application/ld+json">${JSON.stringify({
    '@type': 'NewsArticle',
    headline: 'EU: China soll Exporte von Hybridautos freiwillig reduzieren - Golem.de',
    publisher: { '@type': 'Organization', name: 'Golem.de' },
    isAccessibleForFree: true,
  })}</script>
</head><body><article class="go-article">
<h1>EU: China soll Exporte von Hybridautos freiwillig reduzieren</h1>
<div class="go-article-header__meta"><time>17. September 2026 um 12:39 Uhr</time> <span>/</span> <span class="go-authors"><a class="go-authors__author" href="/specials/autor-tobias-koeltzsch/">Tobias Költzsch</a></span></div>
<div class="go-button-bar go-button-bar--cta-top"><a class="go-button" href="#merken"><span class="go-button__title">Artikel merken</span></a><a class="go-button" href="https://www.google.com/preferences/source?q=golem.de"><span class="go-button__title">Auf Google folgen <span class="go-vh">(öffnet im neuen Fenster)</span></span></a></div>
<div class="go-richtext">
<figure><img src="https://www.golem.de/2609/213146-598935-598934_rc.jpg" alt="Hybridfahrzeuge"><figcaption>Hybridfahrzeuge aus China werden in der EU immer beliebter (Bild: BYD)</figcaption></figure>
<p>Die EU soll China um ein Entgegenkommen gebeten haben, berichtet die <a class="go-external-link" href="https://www.ft.com/content/x">Financial Times<span class="go-vh">(öffnet im neuen Fenster)</span></a> unter Berufung auf drei Personen.</p>
${prose(5, 'Mit den in der Regel günstigeren Fahrzeugen verdrängen die chinesischen Hersteller ihre europäischen Konkurrenten, die auch aus anderen Gründen unter wirtschaftlichen Schwierigkeiten leiden.')}
${closingParagraph}
</div>
<div class="go-button-bar go-button-bar--cta"><a class="go-button" href="https://www.golem.de/"><span class="go-button__title">Zur Startseite</span></a></div>
<ul class="go-alink-list"><li><a class="go-alink" href="https://www.amazon.de/dp/B09Y13TCNZ"><span class="go-alink__title">Hier geht es zu Echo Auto 2 bei Amazon</span></a><span class="go-affiliate-disclosure"><span class="go-vh">Affiliate-Hinweis</span><span>Wenn Sie auf diesen Link klicken und darüber einkaufen, erhält Golem eine kleine Provision.</span></span></li></ul>
</article></body></html>`;
}

const GOLEM_URL = 'https://www.golem.de/news/eu-china-soll-exporte-von-hybridautos-freiwillig-reduzieren-2609-213146.html';
const COMMUNITY_PROMO =
  '<p class="go-article-end"><em>Wir öffnen unsere neue Community für weitere Mitglieder! Sei dabei und <a href="https://community.golem.de/invites/fpGj4bve9x">melde dich an</a>!</em></p>';
const REAL_CLOSING =
  '<p class="go-article-end">Der EU-Handelskommissar Maros Sefcovic reist Anfang Oktober 2026 nach Peking zu Handelsgesprächen.</p>';

function page(head: string, body: string): string {
  return `<html><head>${head}</head><body>${body}</body></html>`;
}

function jsonLd(obj: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

describe('n-tv.de articles', () => {
  it('extracts correct title and removes header noise', () => {
    const article = extractArticle(ntvPage(), NTV_URL);
    expect(article).not.toBeNull();
    expect(article!.title).toBe('Merz schwärmt von morgendlichen S-Bahn-Fahrten in Berlin');
  });

  it('returns null byline when only publisher is credited', () => {
    const article = extractArticle(ntvPage(), NTV_URL);
    expect(article).not.toBeNull();
    expect(article!.byline).toBeNull();
  });

  it('removes audio player and timestamp from textContent', () => {
    const article = extractArticle(ntvPage(), NTV_URL);
    expect(article).not.toBeNull();
    const text = article!.textContent;
    expect(text).not.toContain('00:00');
    expect(text).not.toContain('02:32');
    expect(text).not.toContain('17.09.2026');
    expect(text).not.toContain('Artikel anhören');
    expect(text).not.toContain('"Ich mag das hin und wieder"');
  });

  it('preserves article body and footer source', () => {
    const article = extractArticle(ntvPage(), NTV_URL);
    expect(article).not.toBeNull();
    const text = article!.textContent;
    expect(text).toContain('Quelle: ntv.de, uzh/dpa');
    expect(text).toContain('Absatz 6');
  });

  it('removes hero twin image and its caption', () => {
    const article = extractArticle(ntvPage(), NTV_URL);
    expect(article).not.toBeNull();
    expect(article!.content).not.toContain('<img');
    expect(article!.textContent).not.toContain('Am Berliner S-Bahnhof');
  });
});

describe('golem.de articles', () => {
  it('extracts correct title and byline', () => {
    const article = extractArticle(golemPage(COMMUNITY_PROMO), GOLEM_URL);
    expect(article).not.toBeNull();
    expect(article!.title).toBe('EU: China soll Exporte von Hybridautos freiwillig reduzieren');
    expect(article!.byline).toBe('Tobias Költzsch');
  });

  it('removes CTA buttons, hidden text, affiliate list and promo', () => {
    const article = extractArticle(golemPage(COMMUNITY_PROMO), GOLEM_URL);
    expect(article).not.toBeNull();
    const text = article!.textContent;
    expect(text).not.toContain('öffnet im neuen Fenster');
    expect(text).not.toContain('Artikel merken');
    expect(text).not.toContain('Auf Google folgen');
    expect(text).not.toContain('Zur Startseite');
    expect(text).not.toContain('Wir öffnen unsere neue Community');
    expect(text).not.toContain('Provision');
    expect(text).not.toContain('Hier geht es zu');
    expect(text).not.toContain('12:39 Uhr');
    expect(text).not.toContain('Affiliate-Hinweis');
  });

  it('cleans link text from hidden spans', () => {
    const article = extractArticle(golemPage(COMMUNITY_PROMO), GOLEM_URL);
    expect(article).not.toBeNull();
    expect(article!.textContent).toContain('Financial Times unter Berufung');
  });

  it('removes hero twin rendition image and caption', () => {
    const article = extractArticle(golemPage(COMMUNITY_PROMO), GOLEM_URL);
    expect(article).not.toBeNull();
    expect(article!.content).not.toContain('<img');
    expect(article!.textContent).not.toContain('Hybridfahrzeuge aus China werden');
  });

  it('preserves real closing paragraph without invite link', () => {
    const article = extractArticle(golemPage(REAL_CLOSING), GOLEM_URL);
    expect(article).not.toBeNull();
    expect(article!.textContent).toContain('reist Anfang Oktober 2026 nach Peking');
  });
});

describe('publisher self-credit is not a byline', () => {
  it('ignores meta author when it matches publisher name case-insensitively', () => {
    const html = page(
      '<meta name="author" content="n-tv NACHRICHTEN">' + jsonLd({ '@type': 'NewsArticle', publisher: { '@type': 'Organization', name: 'ntv NACHRICHTEN' } }),
      '<p>x</p>'
    );
    expect(extractAuthor(html)).toBeNull();
  });

  it('ignores domain suffix in publisher name comparison', () => {
    const html = page(
      '<meta property="og:site_name" content="Golem.de"><meta name="author" content="Golem">',
      '<p>x</p>'
    );
    expect(extractAuthor(html)).toBeNull();
  });

  it('prefers person in JSON-LD over self-credit in meta', () => {
    const html = page(
      '<meta property="og:site_name" content="Daily Example"><meta name="author" content="Daily Example">' + jsonLd({ '@type': 'NewsArticle', author: { '@type': 'Person', name: 'Jane Doe' } }),
      '<p>x</p>'
    );
    expect(extractAuthor(html)).toBe('Jane Doe');
  });

  it('does not guess from DOM when structured data credits only publisher', () => {
    const html = page(
      '<meta property="og:site_name" content="Kyiv Post"><meta name="author" content="Kyiv Post">',
      '<div class="author-box">Kyiv Post Kyiv Post is the oldest English news organization in the country.</div>'
    );
    expect(extractAuthor(html)).toBeNull();
  });

  it('preserves real person byline', () => {
    const html = page(
      '<meta property="og:site_name" content="n-tv.de"><meta name="author" content="Volker Petersen">',
      '<p>x</p>'
    );
    expect(extractAuthor(html)).toBe('Volker Petersen');
  });
});

describe('title cleanup', () => {
  it('strips publisher suffix using JSON-LD publisher name', () => {
    const html = page(
      '<meta property="og:title" content="Headline text here - Golem.de">' + jsonLd({ '@type': 'NewsArticle', publisher: { '@type': 'Organization', name: 'Golem.de' } }),
      ''
    );
    expect(extractTitle(html)).toBe('Headline text here');
  });

  it('strips publisher suffix using application-name meta', () => {
    const html = page(
      '<meta name="application-name" content="Golem.de"><meta property="og:title" content="Headline text here - Golem.de">',
      ''
    );
    expect(extractTitle(html)).toBe('Headline text here');
  });

  it('replaces JSON-LD headline with og:title when kicker pattern matches', () => {
    const html = page(
      '<meta property="og:title" content="Inflation zu hoch: EZB erhöht Leitzins auf 2,50 Prozent">' + jsonLd({ '@type': 'NewsArticle', headline: 'Ölpreisschock durch Iran-Krieg: Inflation zu hoch: EZB erhöht Leitzins auf 2,50 Prozent', articleBody: PARAGRAPH.repeat(3) }),
      '<p>x</p>'
    );
    const article = extractArticle(html, 'https://example.com/a');
    expect(article).not.toBeNull();
    expect(article!.title).toBe('Inflation zu hoch: EZB erhöht Leitzins auf 2,50 Prozent');
  });

  it('keeps JSON-LD headline when og:title is not an exact suffix', () => {
    const html = page(
      '<meta property="og:title" content="Something else entirely">' + jsonLd({ '@type': 'NewsArticle', headline: 'Analysis: Rates rise again across the euro area', articleBody: PARAGRAPH.repeat(3) }),
      '<p>x</p>'
    );
    const article = extractArticle(html, 'https://example.com/a');
    expect(article).not.toBeNull();
    expect(article!.title).toBe('Analysis: Rates rise again across the euro area');
  });

  it('keeps JSON-LD headline when og:title is only a fragment', () => {
    const html = page(
      '<meta property="og:title" content="Rates">' + jsonLd({ '@type': 'NewsArticle', headline: 'A very long kicker that runs well past the rest: Rates', articleBody: PARAGRAPH.repeat(3) }),
      '<p>x</p>'
    );
    const article = extractArticle(html, 'https://example.com/a');
    expect(article).not.toBeNull();
    expect(article!.title).toBe('A very long kicker that runs well past the rest: Rates');
  });
});

describe('hero twin in another file format', () => {
  it('removes body image with different extension but same stem as og:image', () => {
    const html = page(
      '<meta property="og:image" content="https://cdn.example.com/img/1200/photo123.jpg">',
      `<article><figure><img src="https://cdn.example.com/img/1024/photo123.webp" alt="x"><figcaption>Unique caption words</figcaption></figure>${prose(6)}</article>`
    );
    const article = extractArticle(html, 'https://example.com/b');
    expect(article).not.toBeNull();
    expect(article!.content).not.toContain('<img');
    expect(article!.textContent).not.toContain('Unique caption words');
  });
});
