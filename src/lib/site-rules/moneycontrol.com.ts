import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a dozen hidden mega-menu dropdowns (account status, "Invest Now" ad
// panels, etc.) live inside the global header and never contain article
// text; strip the whole landmark so a Readability fallback can't grab it
function stripHeader($: cheerio.CheerioAPI): void {
  $('header#common_header').remove();
}

function preprocessMoneycontrolHtml(html: string): string {
  const $ = cheerio.load(html);
  stripHeader($);
  return $('body').html() ?? html;
}

export const moneycontrolRule: SiteRule = {
  preprocessHtml: preprocessMoneycontrolHtml,
};
