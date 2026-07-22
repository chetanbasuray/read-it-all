import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// Ars has no JSON-LD articleBody, so extraction falls to Readability, which
// picks up PhotoSwipe image-gallery captions (text + photo-credit name) as if
// they were body text; removed here, pre-Readability, by their own stable
// classes — the lightbox's own hidden caption template plus the separate,
// always-visible inline caption shown under each gallery image
function stripGalleryCaptions($: cheerio.CheerioAPI): void {
  $('.pswp-caption-content').remove();
  $('.ars-gallery-caption-content').remove();
}

function preprocessArsTechnicaHtml(html: string): string {
  const $ = cheerio.load(html);
  stripGalleryCaptions($);
  return $.html();
}

export const arsTechnicaRule: SiteRule = {
  preprocessHtml: preprocessArsTechnicaHtml,
};
