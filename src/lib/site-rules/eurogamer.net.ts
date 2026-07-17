import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// runs on raw fetched HTML: a cheerio round-trip doesn't corrupt Readability's
// byline here (verified), so $.html() is used (not $('body').html()) to keep
// <head> intact, since extractFirstImage/extractTitle/extractAuthor fall back
// to its og:image/og:title meta and the JSON-LD script when Readability misses
function stripWidgets($: cheerio.CheerioAPI): void {
  // breadcrumb nav ("Home / News / <game>") leads the article header
  $('[data-component="nav-breadcrumbs"]').closest('.breadcrumbs').remove();
  // "Preferred Source" CTA trails the article body
  $('[data-component="preferred-source"]').remove();
  // a related-tag/game-card widget sits right after </article>, inside the
  // same container Readability scores, so it leaks in too
  $('section.tagged-with').remove();
  // this page has ~10 lazy-loaded images, each with a <noscript><img> fallback;
  // one of those alt-text strings is long enough to fool the noscript-based
  // metadata tier into treating it as the article body (same bug already fixed
  // for bylinetimes.com), short-circuiting before Readability ever runs
  $('noscript').remove();
}

function preprocessEurogamerHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const eurogamerRule: SiteRule = {
  preprocessHtml: preprocessEurogamerHtml,
};
