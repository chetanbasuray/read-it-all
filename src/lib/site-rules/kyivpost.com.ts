import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// an Instaread TTS player and a prev/next article nav sit directly in the
// content column, not surrounding chrome, so both need removing before
// Readability ever scores the page; classes are the site's own build output,
// not hashed, so matching on them is stable
function stripWidgets($: cheerio.CheerioAPI): void {
  $('.instaread-player-slot').remove();
  $('.paging-block').remove();
}

function preprocessKyivPostHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $('body').html() ?? html;
}

export const kyivPostRule: SiteRule = {
  preprocessHtml: preprocessKyivPostHtml,
};
