import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a site-wide "my account" slide-out (login status, subscription state) is
// injected into every page near the header, well before the article body.
// A "Home / News / ..." breadcrumb list leads the article on some templates
// (e.g. live-blog pages), matched by its stable aria-label, not its class.
function stripWidgets($: cheerio.CheerioAPI): void {
  $('.comments-chat-side-menu').remove();
  $('nav[aria-label="breadcrumb"]').remove();
}

function preprocessHinduHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const hinduRule: SiteRule = {
  preprocessHtml: preprocessHinduHtml,
};
