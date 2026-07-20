import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// the real byline lives in a nested <span class="byline">, but the
// generic extractAuthor selector ([class*="byline" i]) matches the
// wrapping div.wrap-byline first (it also contains "byline" as a
// substring), pulling in its sibling timestamp/edit-link text too
function fixBylineWrapper($: cheerio.CheerioAPI): void {
  $('.wrap-byline .date, .wrap-byline .edit').remove();
}

// a newsletter-signup form is embedded directly inside the article body
// between paragraphs, not just around it
function stripNewsletterWidget($: cheerio.CheerioAPI): void {
  $('.newsletter-article').remove();
}

function preprocessToiIsraelHtml(html: string): string {
  const $ = cheerio.load(html);
  fixBylineWrapper($);
  stripNewsletterWidget($);
  return $.html();
}

// the byline text itself starts with "By " (e.g. "By ToI Staff"), but the
// reader UI already prepends its own "By " when displaying article.byline
function stripBylinePrefix(byline: string | null): string | null {
  if (!byline) return byline;
  return byline.replace(/^By\s+/i, '').trim() || byline;
}

function polishToiIsraelArticle(article: ArticleData): ArticleData {
  return {
    ...article,
    byline: stripBylinePrefix(article.byline),
  };
}

export const toiIsraelRule: SiteRule = {
  preprocessHtml: preprocessToiIsraelHtml,
  polishArticle: polishToiIsraelArticle,
};
