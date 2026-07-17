import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// runs on the extracted content, not the raw page: a cheerio round-trip of
// this site's raw HTML corrupts Readability's byline detection, pulling in
// the "More by <author>" link text instead of the plain name

// a "more stories on" topic-tag footer and a sidebar (ads plus an
// ajax-loaded "most popular" list, only populated once JS runs, e.g. via
// the browser-render fallback tier) sit around the real article body;
// Readability strips classes from its output, so the footer heading is
// matched by text rather than class
function stripWidgets($: cheerio.CheerioAPI): void {
  $('h4, h3')
    .filter((_, el) => $(el).text().trim() === 'More stories on')
    .closest('div')
    .remove();
  $('#sidebar_outer').remove();
}

function polishRteArticle(article: ArticleData): ArticleData {
  const $ = cheerio.load(article.content);
  stripWidgets($);
  return { ...article, content: $('body').html() ?? article.content };
}

export const rteRule: SiteRule = {
  polishArticle: polishRteArticle,
};
