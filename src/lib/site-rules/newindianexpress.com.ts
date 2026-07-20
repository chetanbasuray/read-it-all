import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// empty ad-slot placeholders sit directly between paragraph blocks inside the
// article body; matched by data-test-id + the (non-hashed) app-ad class
// rather than the widget-m__ CSS-module hash
function stripWidgets($: cheerio.CheerioAPI): void {
  $('[data-test-id="widget"].app-ad').remove();
}

function preprocessNewIndianExpressHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $('body').html() ?? html;
}

export const newIndianExpressRule: SiteRule = {
  preprocessHtml: preprocessNewIndianExpressHtml,
};
