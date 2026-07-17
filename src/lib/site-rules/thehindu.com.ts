import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a site-wide "my account" slide-out (login status, subscription state) is
// injected into every page near the header, well before the article body
function stripWidgets($: cheerio.CheerioAPI): void {
  $('.comments-chat-side-menu').remove();
}

function preprocessHinduHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $('body').html() ?? html;
}

export const hinduRule: SiteRule = {
  preprocessHtml: preprocessHinduHtml,
};
