import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// runs on the extracted content, not the raw page: a cheerio round-trip of
// this site's raw HTML corrupts Readability's byline detection - the byline
// lives only in a <meta name="author"> tag in <head>, which $('body').html()
// discards outright, with no in-body byline element to fall back to

// a "Share this article" social widget (Facebook/X/LinkedIn/Mastodon links
// plus a Shortlink permalink) survives into the extracted content on some
// render paths even though Readability strips <footer> tags outright;
// Readability also strips class attributes from its output, so match by the
// widget's own stable heading text and climb to their shared wrapper
function stripWidgets($: cheerio.CheerioAPI): void {
  $('div, span, h2, h3, h4')
    .filter((_, el) => $(el).text().trim() === 'Share this article')
    .each((_, el) => {
      let widget = $(el);
      while (widget.length && !/Shortlink/.test(widget.text())) {
        widget = widget.parent();
      }
      widget.remove();
    });
}

function polishHeiseArticle(article: ArticleData): ArticleData {
  const $ = cheerio.load(article.content);
  stripWidgets($);
  return { ...article, content: $('body').html() ?? article.content };
}

export const heiseRule: SiteRule = {
  polishArticle: polishHeiseArticle,
};
