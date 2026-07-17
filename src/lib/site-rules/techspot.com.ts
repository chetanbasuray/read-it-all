import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// a category/tag breadcrumb list and a "serving tech enthusiasts" trust
// tagline sit ahead of the real article body; neither lives inside an
// element Readability's unlikely-candidate filter reliably excludes
function stripWidgets($: cheerio.CheerioAPI): void {
  $('ul.category-chicklets').remove();
  $('div.trust-feat').remove();
}

function preprocessTechSpotHtml(html: string): string {
  const $ = cheerio.load(html);
  stripWidgets($);
  return $('body').html() ?? html;
}

export const techSpotRule: SiteRule = {
  preprocessHtml: preprocessTechSpotHtml,
};
