import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// the "Follow <publisher>" button and "Add Yahoo as a preferred source" CTA
// sit in the byline row ahead of the real article body; classes here are
// plain reused Tailwind utilities, so match on the functional attributes
function stripWidgets($: cheerio.CheerioAPI): void {
  $('button[data-ylk*="elm:intent-follow"]').remove();
  $('a[aria-label="Add Yahoo on Google"]').remove();
  $('[role="tooltip"]')
    .filter((_, el) => /preferred source/.test($(el).text()))
    .remove();
}

function preprocessYahooHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $('body').html() ?? html;
}

export const yahooRule: SiteRule = {
  preprocessHtml: preprocessYahooHtml,
};
