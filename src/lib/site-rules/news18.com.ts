import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// the Coral comments widget (disclaimer + "Loading comments..." loader), the
// trailing "Read More" button, an "About the Author" bio card (with its own
// truncation "Read More" toggle), a duplicate breadcrumb, and a "Location:"
// line all live inside <article>, so Readability pulls them in; all are
// matched by stable, non-hashed classes
function stripWidgets($: cheerio.CheerioAPI): void {
  $('#coral-wrap').remove();
  $('[id^="readmore_story-"]').remove();
  $('.atawrap').remove();
  $('.brdcrmb').remove();
  $('.atbtlink.Location').remove();
}

function preprocessNews18Html(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const news18Rule: SiteRule = {
  preprocessHtml: preprocessNews18Html,
};
