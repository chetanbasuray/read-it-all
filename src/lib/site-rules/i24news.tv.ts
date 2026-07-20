import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a comment-count teaser and the (JS-populated) comments section sit as
// siblings at the end of <article>; both use stable, non-hashed identifiers
function stripWidgets($: cheerio.CheerioAPI): void {
  $('.jump-to-comments').remove();
  $('#article-comments').remove();
}

function preprocessI24NewsHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $('body').html() ?? html;
}

export const i24NewsRule: SiteRule = {
  preprocessHtml: preprocessI24NewsHtml,
};
