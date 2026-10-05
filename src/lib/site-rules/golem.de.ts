import * as cheerio from 'cheerio';
import { regex } from 'shorol';
import type { SiteRule } from './types';

// golem names every rendition of one photo "<article>-<rendition>-<source>.jpg",
// with "_rc" on resized crops, so the og:image hero and its in-body twin share
// only the article and source ids and the generic filename check misses them
const RENDITION_REGEX = regex()
  .literal('/')
  .group((b) => b.digit().oneOrMore())
  .literal('-')
  .digit().oneOrMore()
  .literal('-')
  .group((b) => b.digit().oneOrMore())
  .nonCapture((b) => b.literal('_').letter().oneOrMore()).optional()
  .literal('.')
  .word().oneOrMore()
  .end()
  .toRegExp('i');

function sourcePhotoId(src: string | undefined): string | null {
  if (!src) return null;
  try {
    const match = new URL(src, 'https://www.golem.de').pathname.match(RENDITION_REGEX);
    return match ? `${match[1]}-${match[2]}` : null;
  } catch {
    return null;
  }
}

// every class here was checked against a sample of articles to hold only page
// chrome: the bookmark/comments/"Auf Google folgen"/"Zur Startseite" button
// bars (which also carry the "Bitte klicke hier um dich einzuloggen" prompt),
// visually hidden screen-reader text such as "(öffnet im neuen Fenster)" that
// would otherwise weld onto link text, the Amazon affiliate link list, and the
// "date / author" header row, whose author the structured data already supplies.
// p.go-article-end is deliberately not matched: it is often the article's real
// closing paragraph, so the community promo is found by its invite link instead
function stripWidgets($: cheerio.CheerioAPI): void {
  $('.go-button-bar, .go-vh, ul.go-alink-list, .go-article-header__meta').remove();
  $('a[href*="community.golem.de/invites"]').closest('p').remove();

  const hero = sourcePhotoId($('meta[property="og:image"]').attr('content'));
  if (!hero) return;
  $('article figure').each((_, el) => {
    if (sourcePhotoId($(el).find('img').attr('src')) === hero) $(el).remove();
  });
}

function preprocessGolemHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const golemRule: SiteRule = {
  preprocessHtml: preprocessGolemHtml,
};
