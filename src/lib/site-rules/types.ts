import type { ArticleData } from '../scraper';

export interface SiteRule {
  // runs on raw fetched HTML before any extraction (JSON-LD/metadata/Readability) is attempted
  preprocessHtml?: (html: string) => string;
  // runs on the extracted article, from any extraction tier, right before it is returned/cached
  polishArticle?: (article: ArticleData) => ArticleData;
}
