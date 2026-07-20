import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// numbered ad slots ("g g-1", "g g-3", ...) are interspersed through the
// article body, each labeled with a small "Anzeige" (Advertisement) span;
// matched by that label text rather than the generic "g" class, which is too
// short to be a safe selector on its own
function stripAds($: cheerio.CheerioAPI): void {
  $('span')
    .filter((_, el) => $(el).text().trim() === 'Anzeige')
    .each((_, el) => {
      const wrapper = $(el).closest('div[class^="g g-"]');
      (wrapper.length ? wrapper : $(el)).remove();
    });
}

function preprocessHartpunktHtml(html: string): string {
  const $ = cheerio.load(html);
  stripAds($);
  return $('body').html() ?? html;
}

export const hartpunktRule: SiteRule = {
  preprocessHtml: preprocessHartpunktHtml,
};
