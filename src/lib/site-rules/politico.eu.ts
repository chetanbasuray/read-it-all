import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a "related articles" grid, in-article ad asides, the breadcrumb, the
// "Listen to this article" audio player, and the share-link nav all sit
// inside <article> and outscore the real body in Readability's own scoring;
// removed pre-Readability by their own stable classes/aria-labels
function stripWidgets($: cheerio.CheerioAPI): void {
  $('aside').remove();
  $('.content-listing').remove();
  $('nav[aria-label="Breadcrumb"]').remove();
  $('.listen--has-toggle').remove();
  $('nav[aria-label="Share"]').remove();
}

function preprocessPoliticoHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const politicoRule: SiteRule = {
  preprocessHtml: preprocessPoliticoHtml,
};
