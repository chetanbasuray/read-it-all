import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import { renderPage, closeBrowser } from './browser';
import { sanitizeHtml } from './sanitize';

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

const BOT_CHALLENGE_PATTERNS = [
  'captcha-delivery.com',
  'Please enable JS',
  'disable any ad blocker',
  'Checking your browser',
  'DDoS protection',
  'cf-browser-verification',
  'cf-challenge',
  'Just a moment',
  'attention required',
  'Cloudflare',
  'Access denied',
  'Enable JavaScript',
];

function isBotChallengePage(html: string): boolean {
  const lower = html.toLowerCase();
  return BOT_CHALLENGE_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

export function extractFromJsonLd(
  html: string,
): Pick<ArticleData, 'title' | 'content' | 'textContent' | 'byline' | 'image'> | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (const el of scripts) {
    try {
      const raw = $(el).text();
      const data = JSON.parse(raw);
      const items = data['@graph'] || [data];

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
            byline: item.author?.name || null,
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

export function extractAuthor(html: string): string | null {
  const $ = cheerio.load(html);
  const author = $('meta[name="author"]').attr('content');
  if (author) return author;
  const byline = $('[class*="byline"], [class*="author"], [class*="by-line"]').first().text().trim();
  if (byline) return byline;
  return null;
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
    const response = await fetch(url, {
      signal: controller.signal,
      headers,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { html: null, status: response.status, blocked: false };
    }

    const html = await response.text();
    return { html, status: response.status, blocked: isBotChallengePage(html) };
  } catch {
    return { html: null, status: null, blocked: false };
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
      return {
        title: article.title || extractTitle(html) || 'Untitled',
        content: sanitizeHtml(article.content),
        textContent: article.textContent || '',
        excerpt: article.excerpt || article.textContent?.substring(0, 200) || '',
        byline: article.byline || extractAuthor(html) || null,
        image: extractFirstImage(html, url),
        url,
      };
    }
  } catch {
    // Readability parse failed
  }
  return null;
}

function buildArticleFromMetadata(
  html: string,
  url: string,
): ArticleData | null {
  const title = extractTitle(html);
  const content = $tryExtractContentFromNoscript(html);
  if (title && content && content.length > 500) {
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

const USER_AGENTS = [
  {
    ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    name: 'Googlebot',
  },
  {
    ua: 'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    name: 'Bingbot',
  },
  {
    ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    name: 'Facebook',
  },
  {
    ua: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6998.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    name: 'Googlebot-Mobile',
  },
  {
    ua: 'Twitterbot/1.0',
    name: 'Twitterbot',
  },
  {
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/131.0.6998.0 Safari/537.36',
    name: 'Googlebot-Desktop',
  },
];

const ACCEPT_VARIANTS = [
  { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
];

export async function scrapeArticle(
  url: string,
  cookies?: string,
): Promise<ArticleData> {
  const errors: string[] = [];
  let allBlocked = true;

  for (const { ua, name } of USER_AGENTS) {
    for (const headers of ACCEPT_VARIANTS) {
      const { html, status, blocked } = await fetchWithUA(url, ua, headers, cookies);
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

      const jsonld = extractFromJsonLd(html);
      if (jsonld && jsonld.content && jsonld.content.length > 200) {
        return {
          title: jsonld.title || 'Untitled',
          content: jsonld.content,
          textContent: jsonld.textContent || '',
          excerpt: jsonld.textContent?.substring(0, 200) || '',
          byline: jsonld.byline || extractAuthor(html) || null,
          image: jsonld.image || extractFirstImage(html, url),
          url,
        };
      }

      const fromMeta = buildArticleFromMetadata(html, url);
      if (fromMeta) return fromMeta;

      const article = parseWithReadability(html, url);
      if (article) return article;
    }
  }

  if (allBlocked) {
    errors.push(
      'All attempts blocked by anti-bot protection (DataDome, Cloudflare, or similar)',
    );

    const ampUrl = extractAmpUrl(url);
    if (ampUrl) {
      errors.push(`Trying AMP URL: ${ampUrl}`);
      for (const { ua, name } of USER_AGENTS.slice(0, 2)) {
        const { html, blocked } = await fetchWithUA(ampUrl, ua, {
          Referer: 'https://www.google.com/',
        }, cookies);
        if (html && !blocked && html.length > 500) {
          const article = parseWithReadability(html, ampUrl);
          if (article) return article;
          const jsonld = extractFromJsonLd(html);
          if (jsonld && jsonld.content && jsonld.content.length > 200) {
            return {
              title: jsonld.title || 'Untitled',
              content: jsonld.content,
              textContent: jsonld.textContent || '',
              excerpt: jsonld.textContent?.substring(0, 200) || '',
              byline: jsonld.byline || null,
              image: jsonld.image || extractFirstImage(html, url),
              url,
            };
          }
        }
      }
      errors.push('AMP URL also blocked');
    }
  } else {
    errors.push('Direct fetch succeeded but no article body found in HTML');
  }

  try {
    errors.push('Attempting browser rendering (Puppeteer/Browserless)...');
    const browserHtml = await renderPage(url, cookies);
    if (browserHtml && browserHtml.length > 500) {
      const article = parseWithReadability(browserHtml, url);
      if (article) return article;

      const jsonld = extractFromJsonLd(browserHtml);
      if (jsonld && jsonld.content && jsonld.content.length > 200) {
        return {
          title: jsonld.title || 'Untitled',
          content: jsonld.content,
          textContent: jsonld.textContent || '',
          excerpt: jsonld.textContent?.substring(0, 200) || '',
          byline: jsonld.byline || extractAuthor(browserHtml) || null,
          image: jsonld.image || extractFirstImage(browserHtml, url),
          url,
        };
      }
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
    const article = parseWithReadability(googleHtml, url);
    if (article) return article;

    const jsonld = extractFromJsonLd(googleHtml);
    if (jsonld && jsonld.content && jsonld.content.length > 200) {
      return {
        title: jsonld.title || 'Untitled',
        content: jsonld.content,
        textContent: jsonld.textContent || '',
        excerpt: jsonld.textContent?.substring(0, 200) || '',
        byline: jsonld.byline || null,
        image: jsonld.image || extractFirstImage(googleHtml, url),
        url,
      };
    }
  } else {
    errors.push('Google Cache: no snapshot available');
  }

  const waybackHtml = await fetchFromWayback(url);
  if (waybackHtml) {
    const article = parseWithReadability(waybackHtml, url);
    if (article) return article;

    const jsonld = extractFromJsonLd(waybackHtml);
    if (jsonld && jsonld.content && jsonld.content.length > 200) {
      return {
        title: jsonld.title || 'Untitled',
        content: jsonld.content,
        textContent: jsonld.textContent || '',
        excerpt: jsonld.textContent?.substring(0, 200) || '',
        byline: jsonld.byline || null,
        image: jsonld.image || extractFirstImage(waybackHtml, url),
        url,
      };
    }
  } else {
    errors.push('Wayback Machine: no snapshot available or rate-limited');
  }

  if (allBlocked) {
    throw new ScrapeError(
      'This site uses advanced anti-bot protection (DataDome, Cloudflare, etc.) that blocks all automated requests. ' +
      'The article content is served exclusively through JavaScript and requires a valid subscription or session. ' +
      'Try using a browser extension like "Bypass Paywalls" or access the article through Google News / Apple News.',
      errors,
    );
  }

  throw new ScrapeError(
    'Could not extract full article content. The article text may be loaded dynamically via JavaScript, ' +
    'or the page structure is not recognized. Try the original URL in your browser.',
    errors,
  );
}
