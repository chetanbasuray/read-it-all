import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a translated-story link and an unrendered client-side timestamp template both
// sit inside the same wrapper as the real byline, so Readability's byline
// detection latches onto them (e.g. "Leer en español") on articles with no
// named author; a related-article promo card elsewhere on the page also has
// "byline" in its own class name, holding only its own reading-time badge
function stripWidgets($: cheerio.CheerioAPI): void {
  $('.Page-translatedStoryLink').remove();
  $('.Page-dateModified').remove();
  $('.PagePromo-byline-container').remove();
}

function preprocessApNewsHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const apNewsRule: SiteRule = {
  preprocessHtml: preprocessApNewsHtml,
};
