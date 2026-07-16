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

// after the article text, the page trails a "topics"/share block and a "Most
// viewed" sidebar module, both real server-rendered content (not JS-only
// widgets), so Readability/JSON-LD tiers pick them up as if they were article
// text. Matched by their stable heading/label text since Guardian's class
// names are styled-components hashes that change across deploys.
function stripTrailingBoilerplate(html: string): string {
  const $ = cheerio.load(html);

  const mostViewedHeading = $('h3, h4')
    .filter((_, el) => $(el).text().trim() === 'Most viewed')
    .first();
  if (mostViewedHeading.length) {
    // it's a standalone top-level sidebar module, so climb to the element
    // sitting directly under the fragment root and drop the whole thing
    let node = mostViewedHeading;
    while (node.parent().length && !node.parent().is('body')) {
      node = node.parent();
    }
    node.remove();
  }

  const topicsLabel = $('span')
    .filter((_, el) => $(el).text().trim() === 'Explore more on these topics')
    .first();
  if (topicsLabel.length) {
    const block = topicsLabel.parent();
    block.nextAll().remove();
    block.remove();
  }

  // content is a fragment, not a document: $.html() would wrap it in <html><body>
  return $('body').html() ?? html;
}

function polishGuardianArticle(article: ArticleData): ArticleData {
  return {
    ...article,
    content: stripTrailingBoilerplate(stripSkipLinks(article.content)),
  };
}

export const guardianRule: SiteRule = {
  polishArticle: polishGuardianArticle,
};
