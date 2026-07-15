import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// zero-width/invisible characters Reuters injects into body text (a copy-paste/
// scraping deterrent or content fingerprint); render as nothing, safe to strip.
// Built from char codes rather than literal characters or \u escapes so this
// file never contains an actual invisible character (unreadable/undiffable).
const INVISIBLE_CHAR_CODES = [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff];
const INVISIBLE_CHARS = new RegExp(
  `[${INVISIBLE_CHAR_CODES.map((code) => String.fromCharCode(code)).join('')}]`,
  'g',
);

function stripInvisibleChars(text: string): string {
  return text.replace(INVISIBLE_CHARS, '');
}

// Reuters embeds a "Read Next" related-articles carousel and an empty ad-slot
// placeholder directly inside the article body markup, not just around it
function stripEmbeddedWidgets(html: string): string {
  const $ = cheerio.load(html);
  $('[class*="read-next"]').remove();
  $('[class*="ad-slot"]').remove();
  // content is a fragment, not a document: $.html() would wrap it in <html><body>
  return $('body').html() ?? html;
}

function polishReutersArticle(article: ArticleData): ArticleData {
  return {
    ...article,
    title: stripInvisibleChars(article.title),
    content: stripInvisibleChars(stripEmbeddedWidgets(article.content)),
    textContent: stripInvisibleChars(article.textContent),
    excerpt: stripInvisibleChars(article.excerpt),
  };
}

export const reutersRule: SiteRule = {
  polishArticle: polishReutersArticle,
};
