import * as cheerio from 'cheerio';
import { regex } from 'shorol';
import { WWW_PREFIX_REGEX } from '../utils';
import type { FeedEntry } from './types';

// cheerio's xmlMode keeps namespace prefixes on the tag name, so a CSS selector
// has to escape the colon; plain "encoded" silently matches nothing
const CONTENT_ENCODED = 'content\\:encoded';
const DC_CREATOR = 'dc\\:creator';

// RSS 2.0 and Atom differ in element names but not in the shape we need, so both
// collapse to one FeedEntry list rather than branching at every call site
export function parseFeed(xml: string): FeedEntry[] {
  const $ = cheerio.load(xml, { xmlMode: true });

  return $('item, entry')
    .toArray()
    .map((item) => {
      const $item = $(item);

      const child = (selector: string): string | null => {
        const found = $item.children(selector).first();
        return found.length ? found.text().trim() || null : null;
      };

      // an Atom entry carries several <link>s (alternate, self, replies); only
      // rel="alternate", or a bare <link> where the spec defaults to it, is the article
      let link: string | null = null;
      for (const el of $item.children('link').toArray()) {
        const rel = $(el).attr('rel');
        const href = $(el).attr('href');
        if (href && (!rel || rel === 'alternate')) {
          link = href.trim();
          break;
        }
      }
      link = link ?? child('link');

      return {
        link,
        guid: child('guid') ?? child('id'),
        title: child('title'),
        content: child(CONTENT_ENCODED) ?? child('content'),
        summary: child('description') ?? child('summary'),
        author: child(DC_CREATOR) ?? child('author'),
      };
    });
}

const TRAILING_SLASH_REGEX = regex().literal('/').oneOrMore().end().toRegExp();

// feed links and the URL a reader pasted routinely differ by scheme, www, a
// trailing slash or campaign params while pointing at the same article
export function normalizeForMatch(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    // new URL() accepts any scheme, so an opaque guid like "tag:example.com,2026:9"
    // would otherwise normalize to a comparable string instead of being ignored
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.replace(WWW_PREFIX_REGEX, '').toLowerCase();
    const path = parsed.pathname.replace(TRAILING_SLASH_REGEX, '');
    return `${host}${path}`;
  } catch {
    return null;
  }
}

export function findEntryForUrl(entries: FeedEntry[], targetUrl: string): FeedEntry | null {
  const target = normalizeForMatch(targetUrl);
  if (!target) return null;

  for (const entry of entries) {
    // guid is only a match candidate, not an identifier: many feeds put an
    // opaque tag: URI there, which normalizeForMatch rejects as non-http
    for (const candidate of [entry.link, entry.guid]) {
      if (candidate && normalizeForMatch(candidate) === target) return entry;
    }
  }
  return null;
}
