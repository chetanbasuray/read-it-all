import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// TOI's article body has no real <p> tags: paragraphs are plain text nodes
// separated only by these empty inline spans, which collapse to nothing once
// stripped to plain text, running every sentence together. Converting them to
// <br><br> lets Readability re-split the body into real paragraphs.
// The article's JSON-LD articleBody has the same problem but with no markers
// at all to split on, so it's removed to force extraction down to Readability.
function restoreParagraphBreaks($: cheerio.CheerioAPI): void {
  $('span.id-r-component.br').each((_, el) => {
    $(el).replaceWith('<br><br>');
  });
  $('script[type="application/ld+json"]').remove();
}

// the "Download the TOI app" promo is a real anchor baked into the article
// body (via TOI's sng.link app-install redirector), not a separate widget
// div, so it survives every extraction tier unless removed here
function stripAppPromo($: cheerio.CheerioAPI): void {
  $('div.cdatainfo').each((_, el) => {
    if ($(el).find('a[href*="sng.link"]').length) $(el).remove();
  });
}

function stripEmbeddedWidgets($: cheerio.CheerioAPI): void {
  $('[class*="taboola" i], [id*="taboola" i], [class*="mgid" i]').remove();
  $('[class*="pollWrapper" i]').remove();
}

function preprocessToiHtml(html: string): string {
  const $ = cheerio.load(html);
  restoreParagraphBreaks($);
  stripAppPromo($);
  stripEmbeddedWidgets($);
  // content is a fragment, not a document: $.html() would wrap it in <html><body>
  return $('body').html() ?? html;
}

// with JSON-LD removed, byline falls back to the page's byline div, which
// bundles the author name with the publication and a timestamp
// (e.g. "TOI News Desk / TIMESOFINDIA.COM / Jul 15, 2026, 12:46 IST")
function cleanByline(byline: string | null): string | null {
  if (!byline) return byline;
  return byline.split(' / ')[0].trim() || byline;
}

function polishToiArticle(article: ArticleData): ArticleData {
  return {
    ...article,
    byline: cleanByline(article.byline),
  };
}

export const toiRule: SiteRule = {
  preprocessHtml: preprocessToiHtml,
  polishArticle: polishToiArticle,
};
