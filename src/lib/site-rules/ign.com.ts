import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// Google's "Preferred Sources" opt-in button is client-JS-injected (only
// present once the browser-render fallback tier runs), sits as the last
// child inside article-content, and glues onto Readability's output;
// "preferred-source" is a stable, unhashed class, unlike everything else.
// An "IGN Recommends" module and an "In This Article" object-summary embed
// (a game/product info card) sit nearby too, keyed by their own data-cy tags.
function stripWidgets($: cheerio.CheerioAPI): void {
  $('.preferred-source').remove();
  $('.ign-recommends').remove();
  $('[data-cy="object-summary-embed-title"]').closest('div').remove();
}

// $.html() (not $('body').html()) keeps <head> intact: dropping it changes
// which <title> Readability/extractTitle fall back to
function preprocessIgnHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

// Readability's own byline detection glues adjacent DOM text together with
// no separator (byline name, "Updated:" timestamp, comment count all as one
// string), independent of any preprocessing here; split the camelCase-like
// boundary back into words, then drop everything from "Updated" onward
function cleanByline(byline: string | null): string | null {
  if (!byline) return byline;
  const spaced = byline.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.split(/\s*Updated:/i)[0].trim() || byline;
}

function polishIgnArticle(article: ArticleData): ArticleData {
  return { ...article, byline: cleanByline(article.byline) };
}

export const ignRule: SiteRule = {
  preprocessHtml: preprocessIgnHtml,
  polishArticle: polishIgnArticle,
};
