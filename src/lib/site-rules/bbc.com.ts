import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// BBC wraps a full no-JS navigation menu in a <noscript> block. Per the HTML5 spec,
// parsers (including cheerio/htmlparser2) treat <noscript> content as opaque text
// when scripting is assumed enabled, so it can't be targeted with a DOM selector,
// it has to be stripped as a raw string before any HTML parsing happens. Without
// this, buildArticleFromMetadata's noscript-based fallback (which assumes any long
// noscript block is likely an article body) grabs this nav menu as "the article."
const NOSCRIPT_NAV_PATTERN = /<noscript>(?:(?!<\/noscript>)[\s\S])*?NoJsNavigation[\s\S]*?<\/noscript>/gi;

// BBC embeds several non-article widgets directly inside the article body markup:
// an inline video player placeholder (no video without JS, just a "Watch: ..."
// caption), a related-links carousel, a topic tag list, and share/save/"follow on
// Google" buttons packed into the same element as the real byline text. Matched on
// the stable component-name prefix, not the styled-components hash suffix, which
// changes on every BBC deploy.
const JUNK_SELECTORS = [
  '[class*="PortraitVideoConstraint"]',
  '[class*="LinksContainerStyled"]',
  '[class*="TagListStyled"]',
  '[class*="ActionsContainerStyled"]',
  '[class*="GooglePreferredButtonContainerStyled"]',
];

function stripBbcWidgets(html: string): string {
  const withoutNoscriptNav = html.replace(NOSCRIPT_NAV_PATTERN, '');
  const $ = cheerio.load(withoutNoscriptNav);
  for (const selector of JUNK_SELECTORS) {
    $(selector).remove();
  }
  return $.html();
}

export const bbcRule: SiteRule = {
  preprocessHtml: stripBbcWidgets,
};
