import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import { sanitizeHtml } from './sanitize';
import { safeFetch } from './urlSafety';
import { preprocessHtmlForSite, polishArticleForSite } from './site-rules';
import { getTakedown, type TakedownEntry } from './takedowns';
import { recordDomainOutcome, type ScrapeTier } from './domainStats';

async function dynamicRenderPage(url: string, cookies?: string): Promise<string> {
  const { renderPage } = await import('./browser');
  return renderPage(url, cookies);
}

export interface ArticleData {
  title: string;
  content: string;
  textContent: string;
  excerpt: string;
  byline: string | null;
  image: string | null;
  url: string;
  views?: number;
}

export class ScrapeError extends Error {
  details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'ScrapeError';
    this.details = details;
  }
}

export class TakedownError extends Error {
  entry: TakedownEntry;

  constructor(entry: TakedownEntry) {
    super(
      `This content is not available. The publisher requested it be removed (request ${entry.requestId}). See ${entry.link} for details.`,
    );
    this.name = 'TakedownError';
    this.entry = entry;
  }
}

// bare "Cloudflare" is deliberately excluded: countless legitimate sites
// serve it as a CDN (e.g. via Rocket Loader) with no challenge page at all,
// so it was a false-positive block on any of them. "Enable JavaScript" /
// "Please enable JS" are excluded too: they are the standard React/Vue/etc
// no-JS <noscript> fallback text (and video.js's own no-JS fallback), present
// on countless ordinary SPAs that have nothing to do with a bot challenge.
// The patterns below are specific enough to genuine challenge/interstitial
// pages on their own.
const BOT_CHALLENGE_PATTERNS = [
  'captcha-delivery.com',
  'disable any ad blocker',
  'Checking your browser',
  'DDoS protection',
  'cf-browser-verification',
  'cf-challenge',
  'Just a moment',
  'just a quick check',
  'attention required',
  'Access denied',
];

function isBotChallengePage(html: string): boolean {
  const lower = html.toLowerCase();
  return BOT_CHALLENGE_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

// some publishers withhold the real article server-side (subscriber-only,
// logged-out) and serve a legal AI-training notice or subscription paywall
// wall instead, long enough to pass our length/quality thresholds; accepting
// it would be worse than an honest failure, since the reader shows a
// "Cached" badge as if the real article had been extracted
const PAYWALL_BOILERPLATE_PATTERNS = [
  /made available for your personal,?\s*non-commercial use/i,
  /prohibited without prior written permission/i,
  /text and data mining activities under (the )?art\.?\s*4/i,
  /development of any software, machine learning, artificial intelligence/i,
  /subscribe to unlock this article/i,
  /register to unlock this article/i,
  /to read this article for free,?\s*register/i,
  /continue reading (your|this) article with an?\s*\S+\s*subscription/i,
  /thank you for reading[\s\S]{0,120}(subscribe now|unlimited digital access)/i,
];

export function isPaywallBoilerplate(article: Pick<ArticleData, 'content' | 'textContent'>): boolean {
  // FT's subscription barrier component, a stable structural marker independent of its
  // ever-changing marketing copy ("Subscribe"/"Register"/"$" vs "€" pricing, etc.)
  if (article.content.includes('id="barrier-page"')) return true;
  return PAYWALL_BOILERPLATE_PATTERNS.some((p) => p.test(article.textContent));
}

// some publishers (e.g. moneycontrol.com) emit JSON-LD with a literal
// newline/tab inside a string value instead of an escaped \n, which is
// invalid JSON; those control characters are only ever significant inside
// string literals, so collapsing them everywhere is a safe recovery parse
function parseJsonLd(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/[\r\n\t]+/g, ' '));
  }
}

// schema.org's "author" is valid as either a single Person/Organization or an
// array of them (multi-byline articles); a plain `.name` lookup silently
// returns undefined for the array form, which is common even for single-author pieces
function authorNameFromJsonLd(author: unknown): string | null {
  if (!author) return null;
  const people = Array.isArray(author) ? author : [author];
  const names = people
    .map((p) =>
      p && typeof p === 'object' && 'name' in p
        ? String((p as { name: unknown }).name).replace(/\s+/g, ' ').trim()
        : null,
    )
    .filter((n): n is string => !!n);
  return names.length ? names.join(', ') : null;
}

// scans every ld+json script for an author, independent of whether any of them
// also carry an articleBody long enough for extractFromJsonLd's content tier to use
function extractJsonLdAuthorName(html: string): string | null {
  const $ = cheerio.load(html);
  for (const el of $('script[type="application/ld+json"]')) {
    try {
      const data = parseJsonLd($(el).text());
      const items = Array.isArray(data) ? data : data['@graph'] || [data];
      for (const item of items) {
        const name = authorNameFromJsonLd(item.author);
        if (name) return name;
      }
    } catch {
      // continue to next script tag
    }
  }
  return null;
}

export function extractFromJsonLd(
  html: string,
): Pick<ArticleData, 'title' | 'content' | 'textContent' | 'byline' | 'image'> | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (const el of scripts) {
    try {
      const raw = $(el).text();
      const data = parseJsonLd(raw);
      // some publishers emit a bare top-level array instead of wrapping
      // multiple entries in @graph
      const items = Array.isArray(data) ? data : data['@graph'] || [data];

      for (const item of items) {
        if (
          item.articleBody &&
          typeof item.articleBody === 'string' &&
          item.articleBody.length > 200
        ) {
          return {
            title: item.headline || item.title || 'Untitled',
            content: sanitizeHtml(
              item.articleBody
                .split('\n')
                .filter(Boolean)
                .map((p: string) => `<p>${p}</p>`)
                .join(''),
            ),
            textContent: item.articleBody,
            byline: authorNameFromJsonLd(item.author),
            image:
              item.image?.url ||
              (typeof item.image === 'string' ? item.image : null) ||
              null,
          };
        }
      }
    } catch {
      // continue to next script tag
    }
  }

  return null;
}

// publishers set these tags specifically to point at the "real" canonical
// URL for an article, even when it was fetched via a region-redirect or
// tracking wrapper (e.g. moneycontrol.com's /europe/?url=<encoded> path)
export function extractCanonicalUrl(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  const href = $('link[rel="canonical"]').attr('href') || $('meta[property="og:url"]').attr('content');
  if (!href) return null;
  try {
    const resolved = new URL(href, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    return resolved.href;
  } catch {
    return null;
  }
}

// resolves what an image URL actually points at, unwrapping a Cloudflare-style
// resize proxy (/cdn-cgi/image/<params>/<realPath>) and a WordPress-style
// "-WIDTHxHEIGHT" resize suffix, so two differently-sized renditions of the
// same source photo compare equal
function coreImageIdentity(rawUrl: string, baseUrl: string): string | null {
  try {
    const u = new URL(rawUrl, baseUrl);
    const cdnCgiMatch = u.pathname.match(/\/cdn-cgi\/image\/[^/]+\/(.+)$/);
    const pathname = cdnCgiMatch ? `/${cdnCgiMatch[1]}` : u.pathname;
    const filename = pathname.split('/').pop() || '';
    return filename.replace(/-\d+x\d+(?=\.\w+$)/, '');
  } catch {
    return null;
  }
}

// the reader UI renders `image` as a hero above the headline and `content`
// verbatim below it; when a source's first in-body image is the same photo
// used as the lead/og:image, that photo would otherwise render twice
function stripDuplicateLeadImage(content: string, image: string | null, baseUrl: string): string {
  if (!image) return content;
  const $ = cheerio.load(content);
  const firstImg = $('img').first();
  const src = firstImg.attr('src');
  if (!src) return content;
  const a = coreImageIdentity(src, baseUrl);
  const b = coreImageIdentity(image, baseUrl);
  if (!a || a !== b) return content;
  const figure = firstImg.closest('figure');
  (figure.length ? figure : firstImg).remove();
  return $('body').html() || content;
}

export function extractFirstImage(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) return ogImage;
  const twitterImage = $('meta[name="twitter:image"]').attr('content');
  if (twitterImage) return twitterImage;
  const firstImg = $(
    'article img, .post-content img, .entry-content img, main img',
  )
    .first()
    .attr('src');
  if (firstImg) return new URL(firstImg, baseUrl).href;
  return null;
}

export function extractTitle(html: string): string | null {
  const $ = cheerio.load(html);
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle) return ogTitle;
  const twitterTitle = $('meta[name="twitter:title"]').attr('content');
  if (twitterTitle) return twitterTitle;
  const h1 = $('h1').first().text().trim();
  if (h1) return h1;
  const titleTag = $('title').text().trim();
  if (titleTag && !titleTag.includes('wsj.com') && !titleTag.includes('404') && !titleTag.includes('Error')) {
    return titleTag;
  }
  return null;
}

// meta tag / JSON-LD, in that order: both are structured data a publisher
// deliberately set for this exact purpose, more reliable than any DOM guess
function extractStructuredAuthor(html: string): string | null {
  const author = cheerio.load(html)('meta[name="author"]').attr('content');
  return author || extractJsonLdAuthorName(html);
}

// a bracketed placeholder (e.g. AP's "Updated [hour]:[minute] [AMPM]") means the
// candidate is an unrendered client-side timestamp widget, not a byline
function isRealByline(text: string | null | undefined): text is string {
  return !!text && !/\[[a-zA-Z]+\]/.test(text);
}

export function extractAuthor(html: string): string | null {
  const structured = extractStructuredAuthor(html);
  if (structured) return structured;
  // a byline can span sibling elements ("By" + a linked name), leaving the
  // source's own indentation/newlines between them in the joined text
  const byline = cheerio
    .load(html)('[class*="byline" i], [class*="author" i], [class*="by-line" i]')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();
  return isRealByline(byline) ? byline : null;
}

function isConsentGatewayUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return hostname.startsWith('consent.') || pathname.includes('/collectConsent');
  } catch {
    return false;
  }
}

async function fetchWithUA(
  url: string,
  ua: string,
  extraHeaders?: Record<string, string>,
  cookies?: string,
): Promise<{ html: string | null; status: number | null; blocked: boolean }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const headers: Record<string, string> = {
      'User-Agent': ua,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      ...extraHeaders,
    };
    if (cookies) {
      headers.Cookie = cookies;
    }
    const response = await safeFetch(url, {
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { html: null, status: response.status, blocked: false };
    }

    // a redirect chain can land on a GDPR consent gateway (e.g. Yahoo's
    // consent.yahoo.com) instead of the article; that page would otherwise
    // pass every other check and get cached as if it were the real content
    if (isConsentGatewayUrl(response.url)) {
      return { html: null, status: response.status, blocked: true };
    }

    const html = await response.text();
    return { html, status: response.status, blocked: isBotChallengePage(html) };
  } catch {
    return { html: null, status: null, blocked: false };
  }
}

// mimics a visitor landing on the homepage before navigating to an article,
// picking up whatever session/consent cookies a cold article-URL request wouldn't
async function fetchWarmupCookies(url: string, ua: string, xff?: string): Promise<string | null> {
  try {
    const homepageUrl = new URL(url).origin;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await safeFetch(homepageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': ua,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...(xff ? { 'X-Forwarded-For': xff } : {}),
      },
    });
    clearTimeout(timeout);
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length === 0) return null;
    return setCookies.map((c) => c.split(';')[0]).join('; ');
  } catch {
    return null;
  }
}

async function fetchFromGoogleCache(url: string): Promise<string | null> {
  try {
    const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}&strip=1&vwsrc=0`;
    const response = await fetch(cacheUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      redirect: 'follow',
    });
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    const cachedContent = $('#cachedcontent, pre#pre-section, div#cached-content, div#google-cache-main').first();
    if (cachedContent.length && cachedContent.text().length > 500) {
      return `<article>${cachedContent.text().split('\n').filter(Boolean).map((p: string) => `<p>${p}</p>`).join('')}</article>`;
    }

    const resultStats = $('#result-stats').first();
    if (resultStats.length) {
      const snippet = $('span[class*="st"], div[class*="st"]').first().text().trim();
      if (snippet && snippet.length > 500) {
        return `<article><p>${snippet}</p></article>`;
      }
    }

    const allText = $('body').text().trim();
    if (allText.includes('cache:') && allText.length > 200) {
      const searchResult = $('.g, .MjjYud').first().text().trim();
      if (searchResult && searchResult.length > 500) {
        return `<article><p>${searchResult}</p></article>`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchFromWayback(url: string): Promise<string | null> {
  const encoded = encodeURIComponent(url);
  try {
    const availabilityResponse = await fetch(
      `https://archive.org/wayback/available?url=${encoded}`,
    );
    if (!availabilityResponse.ok) return null;
    const data = (await availabilityResponse.json()) as {
      archived_snapshots?: { closest?: { available?: boolean; url?: string } };
    };
    const closest = data?.archived_snapshots?.closest;
    if (!closest?.available || !closest?.url) return null;

    const rawSnapshotUrl = closest.url
      .replace('/https://', 'id_/https://')
      .replace('/http://', 'id_/http://');

    const waybackResponse = await fetch(rawSnapshotUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    });
    if (waybackResponse.ok) return await waybackResponse.text();

    const fallbackResponse = await fetch(closest.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    });
    if (fallbackResponse.ok) {
      const waybackHtml = await fallbackResponse.text();
      const $ = cheerio.load(waybackHtml);
      const iframeSrc = $('iframe#playback').attr('src');
      if (iframeSrc) {
        const iframeResponse = await fetch(
          iframeSrc.startsWith('http')
            ? iframeSrc
            : `https://web.archive.org${iframeSrc}`,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            },
          },
        );
        if (iframeResponse.ok) return await iframeResponse.text();
      }
      return waybackHtml;
    }
  } catch {
    // Wayback Machine unavailable
  }
  return null;
}

export function parseWithReadability(html: string, url: string): ArticleData | null {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article && article.content && article.content.length > 200) {
      // Readability's own byline detection can glue sibling DOM text nodes onto
      // the name (a reading-time badge, an "Updated:" timestamp, ...) with the
      // source's original indentation/newlines still between them; a publisher's
      // own structured author data is never wrong this way, so it wins when present
      const rawByline =
        extractStructuredAuthor(html) ||
        (isRealByline(article.byline) ? article.byline : null) ||
        extractAuthor(html) ||
        null;
      return {
        title: article.title || extractTitle(html) || 'Untitled',
        content: sanitizeHtml(article.content),
        textContent: article.textContent || '',
        excerpt: article.excerpt || article.textContent?.substring(0, 200) || '',
        byline: rawByline ? rawByline.replace(/\s+/g, ' ').trim() : null,
        image: extractFirstImage(html, url),
        url,
      };
    }
  } catch {
    // Readability parse failed
  }
  return null;
}

// a <noscript> block long enough to pass the metadata tier's length check can
// still be CSS/attribute soup rather than prose (a lazy-load plugin's <style>
// tag, or a lazy-loaded <img>'s long src/srcset with no spaces); real article
// text is overwhelmingly plain words, so reject text that isn't
function looksLikeProse(text: string): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length < 20) return false;
  const wordLike = words.filter((w) => /^[A-Za-z][A-Za-z'’-]*[.,;:!?]?$/.test(w));
  return wordLike.length / words.length > 0.6;
}

function buildArticleFromMetadata(
  html: string,
  url: string,
): ArticleData | null {
  const title = extractTitle(html);
  const rawContent = $tryExtractContentFromNoscript(html);
  if (title && rawContent && rawContent.length > 500) {
    // <noscript> is opaque raw text to the parser (not real child nodes), so a
    // page could smuggle live markup (e.g. an onerror handler) straight into
    // stored content; sanitize here just like the JSON-LD and Readability tiers do
    const content = sanitizeHtml(rawContent);
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    if (plainText.length < 200 || !looksLikeProse(plainText)) return null;
    return {
      title,
      content,
      textContent: content.replace(/<[^>]*>/g, ''),
      excerpt: content.replace(/<[^>]*>/g, '').substring(0, 200),
      byline: extractAuthor(html),
      image: extractFirstImage(html, url),
      url,
    };
  }
  return null;
}

function $tryExtractContentFromNoscript(html: string): string | null {
  const $ = cheerio.load(html);
  const noscripts = $('noscript');
  for (const el of noscripts) {
    const text = $(el).text().trim();
    if (text.length > 500) {
      return text
        .split('\n')
        .filter(Boolean)
        .map((p: string) => `<p>${p}</p>`)
        .join('');
    }
  }
  return null;
}

// shared by every fallback tier (direct fetch, warmup, AMP, browser render,
// Google Cache, Wayback) so a per-domain rule only needs to be wired in once.
// fetchUrl is what was actually requested/parsed (matters for relative image resolution
// and site-rule lookup); canonicalUrl is the fallback used as article.url when the page
// itself has no <link rel=canonical>/og:url to resolve a truer identity from.
function finalizeArticle(article: ArticleData, resolvedUrl: string, fetchUrl: string): ArticleData {
  const polished = { ...polishArticleForSite(article), url: resolvedUrl };
  return { ...polished, content: stripDuplicateLeadImage(polished.content, polished.image, fetchUrl) };
}

export function extractArticle(html: string, fetchUrl: string, canonicalUrl: string = fetchUrl): ArticleData | null {
  const preprocessed = preprocessHtmlForSite(fetchUrl, html);
  // site-rule lookup below stays keyed on fetchUrl (the page actually parsed);
  // only the final stored/displayed url is swapped to the resolved canonical
  const resolvedUrl = extractCanonicalUrl(preprocessed, fetchUrl) ?? canonicalUrl;

  const jsonld = extractFromJsonLd(preprocessed);
  if (jsonld && jsonld.content && jsonld.content.length > 200) {
    const candidate = {
      title: jsonld.title || 'Untitled',
      content: jsonld.content,
      textContent: jsonld.textContent || '',
      excerpt: jsonld.textContent?.substring(0, 200) || '',
      byline: jsonld.byline || extractAuthor(preprocessed) || null,
      image: jsonld.image || extractFirstImage(preprocessed, fetchUrl),
      url: fetchUrl,
    };
    if (!isPaywallBoilerplate(candidate)) {
      return finalizeArticle(candidate, resolvedUrl, fetchUrl);
    }
  }

  const fromMeta = buildArticleFromMetadata(preprocessed, fetchUrl);
  if (fromMeta && !isPaywallBoilerplate(fromMeta)) {
    return finalizeArticle({ ...fromMeta, url: fetchUrl }, resolvedUrl, fetchUrl);
  }

  const article = parseWithReadability(preprocessed, fetchUrl);
  if (article && !isPaywallBoilerplate(article)) {
    return finalizeArticle({ ...article, url: fetchUrl }, resolvedUrl, fetchUrl);
  }

  return null;
}

function extractAmpUrl(originalUrl: string): string | null {
  try {
    const u = new URL(originalUrl);
    const pathParts = u.pathname.split('/').filter(Boolean);
    const slug = pathParts[pathParts.length - 1];
    if (!slug || slug.length < 10) return null;
    return `https://${u.hostname}/amp/articles/${slug}`;
  } catch {
    return null;
  }
}

// xff: a real, published crawler IP (Google's 66.249.64.0/19, Bing's
// 40.77.167.0/24) sent as X-Forwarded-For alongside the matching bot UA;
// some sites allowlist these ranges for search-engine crawlers and trust
// this header rather than the actual TCP source, which Vercel's shared
// datacenter IP range is otherwise liable to be blocked on outright
const USER_AGENTS = [
  {
    ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    name: 'Googlebot',
    xff: '66.249.66.1',
  },
  {
    ua: 'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    name: 'Bingbot',
    xff: '40.77.167.1',
  },
  {
    ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    name: 'Facebook',
  },
  {
    ua: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6998.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    name: 'Googlebot-Mobile',
    xff: '66.249.66.1',
  },
  {
    ua: 'Twitterbot/1.0',
    name: 'Twitterbot',
  },
  {
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/131.0.6998.0 Safari/537.36',
    name: 'Googlebot-Desktop',
    xff: '66.249.66.1',
  },
];

const ACCEPT_VARIANTS = [
  { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
];

async function attemptScrape(
  url: string,
  cookies?: string,
): Promise<{ article: ArticleData; tier: ScrapeTier }> {
  // checked first so a takedown also applies to background revalidation
  // (refreshIfStale calls scrapeArticle directly, not through a route)
  const takedown = getTakedown(url);
  if (takedown) {
    throw new TakedownError(takedown);
  }

  const errors: string[] = [];
  let allBlocked = true;

  for (const { ua, name, xff } of USER_AGENTS) {
    for (const headers of ACCEPT_VARIANTS) {
      const requestHeaders = xff ? { ...headers, 'X-Forwarded-For': xff } : headers;
      const { html, status, blocked } = await fetchWithUA(url, ua, requestHeaders, cookies);
      if (!html) {
        if (status !== null) {
          errors.push(`HTTP ${status} (${name})`);
        }
        continue;
      }

      if (blocked) {
        errors.push(`Blocked by bot challenge (${name})`);
        continue;
      }
      allBlocked = false;

      if (html.length < 500) {
        errors.push(`Empty response (${name})`);
        continue;
      }

      const article = extractArticle(html, url);
      if (article) return { article, tier: 'direct-fetch' };
    }
  }

  // cheaper than an AMP retry or full browser render: fetch the homepage first
  // to pick up session/consent cookies a cold article request never gets offered
  const warmupCookies = await fetchWarmupCookies(url, USER_AGENTS[0].ua, USER_AGENTS[0].xff);
  if (warmupCookies) {
    const mergedCookies = cookies ? `${cookies}; ${warmupCookies}` : warmupCookies;
    const warmupHeaders = USER_AGENTS[0].xff ? { 'X-Forwarded-For': USER_AGENTS[0].xff } : undefined;
    const { html, blocked } = await fetchWithUA(url, USER_AGENTS[0].ua, warmupHeaders, mergedCookies);
    if (html && !blocked && html.length > 500) {
      const article = extractArticle(html, url);
      if (article) return { article, tier: 'warmup' };
    }
    errors.push('Domain warmup did not yield article content');
  } else {
    errors.push('Domain warmup: homepage set no cookies');
  }

  if (allBlocked) {
    errors.push(
      'All attempts blocked by anti-bot protection (DataDome, Cloudflare, or similar)',
    );

    const ampUrl = extractAmpUrl(url);
    if (ampUrl) {
      errors.push(`Trying AMP URL: ${ampUrl}`);
      for (const { ua, name, xff } of USER_AGENTS.slice(0, 2)) {
        const { html, blocked } = await fetchWithUA(ampUrl, ua, {
          Referer: 'https://www.google.com/',
          ...(xff ? { 'X-Forwarded-For': xff } : {}),
        }, cookies);
        if (html && !blocked && html.length > 500) {
          const article = extractArticle(html, ampUrl, url);
          if (article) return { article, tier: 'amp' };
        }
      }
      errors.push('AMP URL also blocked');
    }
  } else {
    errors.push('Direct fetch succeeded but no article body found in HTML');
  }

  try {
    errors.push('Attempting browser rendering (Playwright/Browserless)...');
    const browserHtml = await dynamicRenderPage(url, cookies);
    if (browserHtml && browserHtml.length > 500 && !isBotChallengePage(browserHtml)) {
      const article = extractArticle(browserHtml, url);
      if (article) return { article, tier: 'browser-render' };
    }
    errors.push('Browser rendering did not yield article content');
  } catch (e) {
    errors.push(
      `Browser rendering failed: ${e instanceof Error ? e.message : 'unknown error'}`,
    );
  } finally {
    // Browser instance is a module-level singleton managed by browser.ts — don't close it here
  }

  const googleHtml = await fetchFromGoogleCache(url);
  if (googleHtml) {
    const article = extractArticle(googleHtml, url);
    if (article) return { article, tier: 'google-cache' };
  } else {
    errors.push('Google Cache: no snapshot available');
  }

  const waybackHtml = await fetchFromWayback(url);
  if (waybackHtml) {
    const article = extractArticle(waybackHtml, url);
    if (article) return { article, tier: 'wayback' };
  } else {
    errors.push('Wayback Machine: no snapshot available or rate-limited');
  }

  if (allBlocked) {
    throw new ScrapeError(
      'This site is not one we can access well yet, we are working on improving support for it. ' +
      'In the meantime, try a browser extension like "Bypass Paywalls," or check Google News / Apple News for this article.',
      errors,
    );
  }

  throw new ScrapeError(
    'We could not extract the full article from this page yet, we are working on improving support for sites like this. ' +
    'Try opening the original URL directly in your browser.',
    errors,
  );
}

export async function scrapeArticle(url: string, cookies?: string): Promise<ArticleData> {
  try {
    const { article, tier } = await attemptScrape(url, cookies);
    void recordDomainOutcome(url, tier);
    return article;
  } catch (error) {
    // a takedown is an intentional block, not a scraping-quality signal, so it
    // should not count against a domain's success rate
    if (!(error instanceof TakedownError)) {
      void recordDomainOutcome(url, 'failed');
    }
    throw error;
  }
}
