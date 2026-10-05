import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// the article header repeats the kicker and headline the reader already shows
// as its title, then a timestamp and an "Artikel anhören" audio player whose
// "00:00 / 02:32" readout Readability keeps as the body's opening line. Matched
// by stable class prefix, since the hashed CSS-module suffixes change across deploys
function stripWidgets($: cheerio.CheerioAPI): void {
  $('[class*="article-detail-head_head"]').remove();
  $('[class*="AudioPlayer_audio"]').remove();
}

function preprocessNtvHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const ntvRule: SiteRule = {
  preprocessHtml: preprocessNtvHtml,
};
