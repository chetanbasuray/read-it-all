import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a conference/newsletter "subscription plea" module sometimes gets folded
// into the article body; matched by its own stable data-cy test id
function stripWidgets($: cheerio.CheerioAPI): void {
  $('[data-cy="subscriptionPlea"]').remove();
}

function preprocessFortuneHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const fortuneRule: SiteRule = {
  preprocessHtml: preprocessFortuneHtml,
};
