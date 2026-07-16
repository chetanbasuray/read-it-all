import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// runs on the extracted content, not the raw page: a cheerio round-trip of
// this site's raw HTML corrupts Readability's title/byline detection, even
// with nothing removed. Readability also strips class attributes from its
// output, so matching is by text rather than class.
function stripWidgets($: cheerio.CheerioAPI): void {
  $('p, span')
    .filter((_, el) => /Published:/.test($(el).text()))
    .each((_, el) => {
      $(el).remove();
    });

  $('li, strong')
    .filter((_, el) => /Preferred Source/.test($(el).text()))
    .each((_, el) => {
      const list = $(el).closest('ul');
      (list.length ? list : $(el)).remove();
    });
}

function polishDailyMailArticle(article: ArticleData): ArticleData {
  const $ = cheerio.load(article.content);
  stripWidgets($);
  return { ...article, content: $('body').html() ?? article.content };
}

export const dailyMailRule: SiteRule = {
  polishArticle: polishDailyMailArticle,
};
