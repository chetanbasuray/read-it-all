import * as cheerio from 'cheerio';
import { regex } from 'shorol';
import type { SiteRule } from './types';

// lowercase-only on purpose, no ignoreCase() -- Yahoo's own copy is lowercase
const PREFERRED_SOURCE_PATTERN = regex().literal('preferred source').toRegExp();

// the "Follow <publisher>" button and "Add Yahoo as a preferred source" CTA
// sit in the byline row ahead of the real article body; classes here are
// plain reused Tailwind utilities, so match on the functional attributes
function stripWidgets($: cheerio.CheerioAPI): void {
  $('button[data-ylk*="elm:intent-follow"]').remove();
  $('a[aria-label="Add Yahoo on Google"]').remove();
  $('[role="tooltip"]')
    .filter((_, el) => PREFERRED_SOURCE_PATTERN.test($(el).text()))
    .remove();
}

function preprocessYahooHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const yahooRule: SiteRule = {
  preprocessHtml: preprocessYahooHtml,
};
