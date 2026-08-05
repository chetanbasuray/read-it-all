import * as cheerio from 'cheerio';
import { regex, type Builder } from 'shorol';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

const weekdayAlternation = (b: Builder) =>
  b.literal('Mon').orLiteral('Tue').orLiteral('Wed').orLiteral('Thu').orLiteral('Fri').orLiteral('Sat').orLiteral('Sun');
const WEEKDAY_BOUNDARY_REGEX = regex().group((b) => b.range('a', 'z')).group(weekdayAlternation).toRegExp();
const WEEKDAY_SPLIT_REGEX = regex().whitespace().oneOrMore().nonCapture(weekdayAlternation).toRegExp();

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
  const spaced = byline.replace(WEEKDAY_BOUNDARY_REGEX, '$1 $2');
  return spaced.split(WEEKDAY_SPLIT_REGEX)[0].trim() || byline;
}

function polishNationalDeskArticle(article: ArticleData): ArticleData {
  return { ...article, byline: cleanByline(article.byline) };
}

export const nationalDeskRule: SiteRule = {
  preprocessHtml: preprocessNationalDeskHtml,
  polishArticle: polishNationalDeskArticle,
};
