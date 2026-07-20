import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a share-button aside (its "link copied" tooltip and a "prefer us on
// Google" plug), a mid-article ad slot, a second ad + Taboola widget, and a
// "top news" related-articles aside all sit inside <article> around the
// real text
function stripWidgets($: cheerio.CheerioAPI): void {
  $('.post_news_service').remove();
  $('.advtext_mob, .advtext').remove();
  $('.nts-ad').remove();
  $('.unit_side_banner').remove();
  $('.section_other_news').remove();
}

function preprocessPravdaHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const pravdaRule: SiteRule = {
  preprocessHtml: preprocessPravdaHtml,
};
