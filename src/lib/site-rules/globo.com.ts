import * as cheerio from 'cheerio';
import { regex } from 'shorol';
import type { SiteRule } from './types';

const POR_PREFIX_REGEX = regex().start().literal('Por').whitespace().oneOrMore().toRegExp('i');
const VIDEOS_HEADING_PATTERN = regex().literal('VÍDEOS: agora no g1').toRegExp('i');

// the byline sits in a G1-specific class ("Por Redação g1"), not one of the
// generic byline/author class patterns extractAuthor() already checks; lift
// it into a real <meta name="author"> tag so the normal extraction path picks it up
function injectByline($: cheerio.CheerioAPI): void {
  const byline = $('.content-publication-data__from').first().text().trim().replace(POR_PREFIX_REGEX, '');
  if (byline && !$('meta[name="author"]').length) {
    $('head').append($('<meta>').attr('name', 'author').attr('content', byline));
  }
}

// in-article video widgets (with their own "VÍDEOS: agora no g1" heading)
// that this reader has no player for and would otherwise leak captions/labels
function stripVideoWidgets($: cheerio.CheerioAPI): void {
  $('.cxm-block-video').remove();
  $('.content-intertitle')
    .filter((_, el) => VIDEOS_HEADING_PATTERN.test($(el).text()))
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
