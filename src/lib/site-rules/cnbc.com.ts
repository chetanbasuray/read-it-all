import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// runs on the extracted content, not the raw page: a cheerio round-trip of
// this site's raw HTML corrupts Readability's byline detection, gluing the
// Twitter/LinkedIn handle and the "WATCH LIVE" link text onto the author name

// Readability sometimes folds three widgets into the article body: the
// header (category eyebrow, duplicate headline, timestamps, byline, "WATCH
// LIVE" link), a "preferred source on Google" CTA, and a live-TV/audio
// sidebar rail; Readability only strips class attributes, not id/data-*, so
// each is matched by its own stable, non-hashed identifier
function stripWidgets($: cheerio.CheerioAPI): void {
  $('#main-article-header').remove();
  $('[data-module="GooglePreferredSource"]').remove();
  $('[id*="WatchLiveRightRail"]').remove();
}

function polishCnbcArticle(article: ArticleData): ArticleData {
  const $ = cheerio.load(article.content);
  stripWidgets($);
  return { ...article, content: $('body').html() ?? article.content };
}

export const cnbcRule: SiteRule = {
  polishArticle: polishCnbcArticle,
};
