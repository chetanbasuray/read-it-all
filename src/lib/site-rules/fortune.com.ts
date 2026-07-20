import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// runs on the extracted content, not the raw page: a cheerio round-trip of
// this site's raw HTML corrupts Readability's title/byline detection, even
// with nothing removed

// a conference/newsletter "subscription plea" module sometimes gets folded
// into the article body; Readability only strips class attributes, not
// data-*, so it's matched by its own stable data-cy test id
function stripWidgets($: cheerio.CheerioAPI): void {
  $('[data-cy="subscriptionPlea"]').remove();
}

function polishFortuneArticle(article: ArticleData): ArticleData {
  const $ = cheerio.load(article.content);
  stripWidgets($);
  return { ...article, content: $('body').html() ?? article.content };
}

export const fortuneRule: SiteRule = {
  polishArticle: polishFortuneArticle,
};
