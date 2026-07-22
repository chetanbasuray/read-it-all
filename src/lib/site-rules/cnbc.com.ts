import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// Readability sometimes folds three widgets into the article body: the
// header (category eyebrow, duplicate headline, timestamps, byline, "WATCH
// LIVE" link), a "preferred source on Google" CTA, and a live-TV/audio
// sidebar rail; each is matched by its own stable, non-hashed identifier
function stripWidgets($: cheerio.CheerioAPI): void {
  $('#main-article-header').remove();
  $('[data-module="GooglePreferredSource"]').remove();
  $('[id*="WatchLiveRightRail"]').remove();
}

function preprocessCnbcHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const cnbcRule: SiteRule = {
  preprocessHtml: preprocessCnbcHtml,
};
