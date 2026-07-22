import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

function stripWidgets($: cheerio.CheerioAPI): void {
  $('.byline-section').remove();

  // no stable class survives for this one across articles, so match by text
  $('li, strong')
    .filter((_, el) => /Preferred Source/.test($(el).text()))
    .each((_, el) => {
      const list = $(el).closest('ul');
      (list.length ? list : $(el)).remove();
    });
}

function preprocessDailyMailHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const dailyMailRule: SiteRule = {
  preprocessHtml: preprocessDailyMailHtml,
};
