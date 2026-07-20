import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a lazy-loaded image's <noscript> fallback is opaque to the HTML parser
// (treated as one text node, not real elements), so its long src/srcset
// attribute string reads as "500+ characters of content" to the
// noscript-based extraction fallback, short-circuiting before Readability
// ever runs and producing a near-empty "article" (just that one image)
function stripNoscriptImageFallback($: cheerio.CheerioAPI): void {
  $('noscript').remove();
}

// a magazine-subscription promo block sits between the article's byline
// and its first real paragraph, inside the same wp-block-columns wrapper
// used elsewhere on the page for legitimate layout, so it's targeted by
// the specific heading it contains rather than removed by class alone
function stripSubscribePromo($: cheerio.CheerioAPI): void {
  const heading = $('#h-read-our-monthly-magazine, h2:contains("Read our Monthly Magazine")').first();
  const wrapper = heading.closest('.wp-block-columns');
  if (wrapper.length) wrapper.remove();
}

function preprocessBylineTimesHtml(html: string): string {
  const $ = cheerio.load(html);
  stripNoscriptImageFallback($);
  stripSubscribePromo($);
  return $.html();
}

export const bylineTimesRule: SiteRule = {
  preprocessHtml: preprocessBylineTimesHtml,
};
