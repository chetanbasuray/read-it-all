import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// The Guardian wraps embedded widgets (newsletter signup, etc.) with an accessible
// "skip past X" link and its target, for screen readers to jump over the widget.
// The widget itself only renders with JS, so our extraction is left with just this
// skip-navigation markup as inert leftover text, with nothing left to skip past.
function stripSkipLinks(html: string): string {
  const $ = cheerio.load(html);
  $('a:contains("skip past")').each((_, el) => {
    $(el).closest('figure').remove();
  });
  // content is a fragment, not a document: $.html() would wrap it in <html><body>
  return $('body').html() ?? html;
}

function polishGuardianArticle(article: ArticleData): ArticleData {
  return {
    ...article,
    content: stripSkipLinks(article.content),
  };
}

export const guardianRule: SiteRule = {
  polishArticle: polishGuardianArticle,
};
