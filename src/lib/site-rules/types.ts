import type { ArticleData } from '../scraper';

export interface SiteRule {
  // runs on raw fetched HTML before any extraction (JSON-LD/metadata/Readability) is attempted.
  // Must serialize with `$.html()`, never `$('body').html()` — the latter drops <head>, which
  // starves Readability's metadata-based byline lookup and forces a much cruder DOM-heuristic
  // fallback that glues sibling text onto the name. When adding a new preprocessHtml rule,
  // diff extractArticle()'s byline before/after the change against real captured HTML.
  preprocessHtml?: (html: string) => string;
  // runs on the extracted article, from any extraction tier, right before it is returned/cached
  polishArticle?: (article: ArticleData) => ArticleData;
}
