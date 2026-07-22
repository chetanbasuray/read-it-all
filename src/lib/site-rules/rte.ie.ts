import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a "more stories on" topic-tag footer and a sidebar (ads plus an
// ajax-loaded "most popular" list, only populated once JS runs, e.g. via
// the browser-render fallback tier) sit around the real article body
function stripWidgets($: cheerio.CheerioAPI): void {
  $('.tags-container').remove();
  $('#sidebar_outer').remove();
}

function preprocessRteHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const rteRule: SiteRule = {
  preprocessHtml: preprocessRteHtml,
};
