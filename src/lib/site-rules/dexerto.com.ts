import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a "Trending" topics rail sits inside <article>, immediately before the
// headline; matched by its h2 text since the surrounding classes are
// generic Tailwind utilities, not site-specific
function stripTrendingRail($: cheerio.CheerioAPI): void {
  $('h2')
    .filter((_, el) => $(el).text().trim() === 'Trending')
    .closest('nav')
    .remove();
}

// every <aside> inside the article is boilerplate: inline "Article continues
// after ad" slots between paragraphs, plus a trailing sidebar bundling a
// "Featured Articles" module and a newsletter signup widget; none carry
// real article prose
function stripAsides($: cheerio.CheerioAPI): void {
  $('aside').remove();
}

function preprocessDexertoHtml(html: string): string {
  const $ = cheerio.load(html);
  stripTrendingRail($);
  stripAsides($);
  return $.html();
}

export const dexertoRule: SiteRule = {
  preprocessHtml: preprocessDexertoHtml,
};
