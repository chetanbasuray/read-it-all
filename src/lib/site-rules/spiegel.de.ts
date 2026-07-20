import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a related-articles block ("Mehr zum Thema"), a "DEBATTE" discussion CTA, and
// a page footer are embedded as siblings of the real paragraph sections inside
// <article>; none carry a class Readability would flag as boilerplate, so
// match by data-area instead
function stripWidgets($: cheerio.CheerioAPI): void {
  $('footer[data-area="article-footer"]').remove();
  $('[data-area="related_articles"]').remove();
  $('[data-area="debate"]').closest('[data-sara-click-el="body_element"]').remove();
  // the trailing author-abbreviation credit (e.g. "aeh/fhi") has no marker of
  // its own; it's always the sibling right after the real body content
  $('[data-area="body"]').next().remove();
}

function preprocessSpiegelHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $('body').html() ?? html;
}

export const spiegelRule: SiteRule = {
  preprocessHtml: preprocessSpiegelHtml,
};
