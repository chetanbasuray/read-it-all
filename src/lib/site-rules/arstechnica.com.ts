import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// runs on the extracted content, not the raw page: a cheerio round-trip of
// this site's raw HTML corrupts Readability's byline detection, even with
// nothing removed

// Ars has no JSON-LD articleBody, so extraction falls to Readability, which
// picks up a PhotoSwipe image-gallery caption (text + photo-credit name) as
// if it were body text; Readability strips classes from its output, so the
// pair is matched by its stable shape instead: a <p> whose only children are
// exactly two bare <span>s, a shape normal prose paragraphs don't have
function stripGalleryCaptions($: cheerio.CheerioAPI): void {
  $('p')
    .filter((_, el) => {
      const children = $(el).children();
      return children.length === 2 && children.filter('span').length === 2;
    })
    .remove();
}

function polishArsTechnicaArticle(article: ArticleData): ArticleData {
  const $ = cheerio.load(article.content);
  stripGalleryCaptions($);
  return { ...article, content: $('body').html() ?? article.content };
}

export const arsTechnicaRule: SiteRule = {
  polishArticle: polishArsTechnicaArticle,
};
