import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// the "Home > Category" breadcrumb sits inside the same <header> as the real
// h1/byline; it carries no stable class/id of its own, only an accessible
// aria-label, so key off that and remove just its <section> wrapper, leaving
// the headline/byline intact
function stripBreadcrumb($: cheerio.CheerioAPI): void {
  $('a[aria-label="Navigate to the Home page"]').closest('section').remove();
}

function preprocessMashableHtml(html: string): string {
  const $ = cheerio.load(html);
  stripBreadcrumb($);
  return $('body').html() ?? html;
}

export const mashableRule: SiteRule = {
  preprocessHtml: preprocessMashableHtml,
};
