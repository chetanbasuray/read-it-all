import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a "Connections"/Wordle-style puzzle promo card sits right after the article
// body on The Athletic (served under nytimes.com/athletic); matched by its
// stable class prefix, since the hashed CSS-module suffix changes across deploys
function stripWidgets($: cheerio.CheerioAPI): void {
  $('[class*="PuzzleEntryPoint"]').remove();
}

function preprocessNytimesHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const nytimesRule: SiteRule = {
  preprocessHtml: preprocessNytimesHtml,
};
