import type { SiteRule } from './types';

// BBC wraps a full no-JS navigation menu in a <noscript> block. Per the HTML5 spec,
// parsers (including cheerio/htmlparser2) treat <noscript> content as opaque text
// when scripting is assumed enabled, so it can't be targeted with a DOM selector,
// it has to be stripped as a raw string before any HTML parsing happens. Without
// this, buildArticleFromMetadata's noscript-based fallback (which assumes any long
// noscript block is likely an article body) grabs this nav menu as "the article."
const NOSCRIPT_NAV_PATTERN = /<noscript>(?:(?!<\/noscript>)[\s\S])*?NoJsNavigation[\s\S]*?<\/noscript>/gi;

function stripNoJsNavigation(html: string): string {
  return html.replace(NOSCRIPT_NAV_PATTERN, '');
}

export const bbcRule: SiteRule = {
  preprocessHtml: stripNoJsNavigation,
};
