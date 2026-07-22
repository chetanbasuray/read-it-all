import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a "Share this article" social widget (Facebook/X/LinkedIn/Mastodon links
// plus a Shortlink permalink) survives into the extracted content on some
// render paths even though Readability strips <footer> tags outright
function stripWidgets($: cheerio.CheerioAPI): void {
  $('.article-sharing').remove();
}

function preprocessHeiseHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $.html();
}

export const heiseRule: SiteRule = {
  preprocessHtml: preprocessHeiseHtml,
};
