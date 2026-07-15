import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// CNN's article HTML nests the persistent site chrome (nav menu, an ad-feedback
// modal's leftover text, an app-download promo) inside the same container
// Readability selects as the article body, not cleanly separated from it.
function stripCnnWidgets(html: string): string {
  const $ = cheerio.load(html);
  $('#headerSubNav').remove();
  $('#ad-feedback__modal-overlay').remove();

  // no stable id/class on this one, so match on its own text instead, walking up
  // to the ancestor that also wraps its sibling paragraph (the QR code caption)
  $('h2:contains("Download the CNN app")').each((_, el) => {
    let node = $(el).parent();
    while (node.length && !node.text().includes('Scan the QR code')) {
      node = node.parent();
    }
    if (node.length) node.remove();
  });

  return $.html();
}

export const cnnRule: SiteRule = {
  preprocessHtml: stripCnnWidgets,
};
