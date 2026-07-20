import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// a "TOPICS:" tag-list sits as its own <ul> right before the real story
// paragraphs inside the same story-content container; its class is a hashed
// CSS-module name, so match by text instead
function stripWidgets($: cheerio.CheerioAPI): void {
  $('p')
    .filter((_, el) => $(el).text().trim() === 'TOPICS:')
    .closest('ul')
    .remove();
}

function preprocessNationalDeskHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

// Readability's byline glues the outlet name straight to the publish
// weekday/timestamp with no separator (e.g. "DeskFri, July 17th..."); split
// the boundary back into words, then drop everything from the weekday onward
function cleanByline(byline: string | null): string | null {
  if (!byline) return byline;
  const spaced = byline.replace(/([a-z])(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/, '$1 $2');
  return spaced.split(/\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)[0].trim() || byline;
}

function polishNationalDeskArticle(article: ArticleData): ArticleData {
  return { ...article, byline: cleanByline(article.byline) };
}

export const nationalDeskRule: SiteRule = {
  preprocessHtml: preprocessNationalDeskHtml,
  polishArticle: polishNationalDeskArticle,
};
