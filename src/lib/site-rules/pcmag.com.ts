import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// the real byline link has no class the generic extractAuthor selector
// matches (it's keyed off an id/data-element, not a byline/author class),
// so mark it directly; its own text is just the name, with "By" and the
// publish date living in sibling nodes outside the link
function markByline($: cheerio.CheerioAPI): void {
  $('a[data-element="author-name"]').first().addClass('byline-marker');
}

// a related-links block, an author-bio card, and an unrelated "more
// stories" module are embedded directly inside the article body, each
// identified by a stable data-parent-group attribute
function stripWidgets($: cheerio.CheerioAPI): void {
  $('[data-parent-group="related-stories"]').remove();
  $('[data-parent-group="author-bio"]').remove();
  $('[data-parent-group="dig-deeper"]').remove();
}

function preprocessPcmagHtml(html: string): string {
  const $ = cheerio.load(html);
  markByline($);
  stripWidgets($);
  return $.html();
}

export const pcmagRule: SiteRule = {
  preprocessHtml: preprocessPcmagHtml,
};
