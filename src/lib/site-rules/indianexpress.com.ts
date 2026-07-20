import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// a breadcrumb nav's last item echoes the full headline via aria-current="page"
// (a "duplicate headline" leak); a live-blog/latest-news sidebar column and a
// comment post/read widget sit alongside/after the article body; all matched
// by stable ids/classes, not hashed ones
function stripWidgets($: cheerio.CheerioAPI): void {
  $('#ie-breadcrumb').remove();
  $('.rightpanel').remove();
  $('.ie-network-commenting').remove();
}

function preprocessIndianExpressHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $('body').html() ?? html;
}

// Readability's byline glues the author names to a "N min read" reading-time
// badge and an "Updated:" timestamp with no separator; drop everything from
// "N min read" onward, and the "Written by:" prefix the reader UI doesn't need
function cleanByline(byline: string | null): string | null {
  if (!byline) return byline;
  return byline.replace(/^Written by:\s*/i, '').split(/\d+\s*min\s*read/i)[0].trim() || byline;
}

function polishIndianExpressArticle(article: ArticleData): ArticleData {
  return { ...article, byline: cleanByline(article.byline) };
}

export const indianExpressRule: SiteRule = {
  preprocessHtml: preprocessIndianExpressHtml,
  polishArticle: polishIndianExpressArticle,
};
