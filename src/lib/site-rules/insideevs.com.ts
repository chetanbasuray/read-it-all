import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// the site's own JSON-LD articleBody has a "Related Articles" list of other
// headlines baked directly into the text, one paragraph after the real
// closing line; once split into <p> tags it's its own trailing paragraph
function stripRelatedArticles($: cheerio.CheerioAPI): void {
  const marker = $('p')
    .filter((_, el) => $(el).text().trim().startsWith('Related Articles'))
    .first();
  if (marker.length) {
    marker.nextAll().remove();
    marker.remove();
  }
}

function polishInsideEvsArticle(article: ArticleData): ArticleData {
  const $ = cheerio.load(article.content);
  stripRelatedArticles($);
  return { ...article, content: $('body').html() ?? article.content };
}

export const insideEvsRule: SiteRule = {
  polishArticle: polishInsideEvsArticle,
};
