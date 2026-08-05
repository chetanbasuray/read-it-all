import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// the byline sits in a G1-specific class ("Por Redação g1"), not one of the
// generic byline/author class patterns extractAuthor() already checks; lift
// it into a real <meta name="author"> tag so the normal extraction path picks it up
function injectByline($: cheerio.CheerioAPI): void {
  const byline = $('.content-publication-data__from').first().text().trim().replace(/^Por\s+/i, '');
  if (byline && !$('meta[name="author"]').length) {
    $('head').append($('<meta>').attr('name', 'author').attr('content', byline));
  }
}

// in-article video widgets (with their own "VÍDEOS: agora no g1" heading)
// that this reader has no player for and would otherwise leak captions/labels
function stripVideoWidgets($: cheerio.CheerioAPI): void {
  $('.cxm-block-video').remove();
  $('.content-intertitle')
    .filter((_, el) => /VÍDEOS: agora no g1/i.test($(el).text()))
    .remove();
}

function preprocessGloboHtml(html: string): string {
  const $ = cheerio.load(html);
  injectByline($);
  stripVideoWidgets($);
  return $.html();
}

export const globoRule: SiteRule = {
  preprocessHtml: preprocessGloboHtml,
};
