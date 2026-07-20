import * as cheerio from 'cheerio';
import type { SiteRule } from './types';

// the category breadcrumb (e.g. "Politik Deutschland") sits right before
// the headline; the plain "kicker" class is reused on every teaser card on
// the page, so key off the tracking attribute, which is unique to the
// article header
function stripKicker($: cheerio.CheerioAPI): void {
  $('[data-tracking-name="content-detail-kicker"]').remove();
}

// the publish date renders twice back-to-back: a numeric <time> that dw.com
// itself marks aria-hidden (a decorative duplicate skipped by screen
// readers) next to the German-language span carrying the real accessible
// text; drop the redundant numeric one
function dedupePublishDate($: cheerio.CheerioAPI): void {
  $('.publication time[aria-hidden="true"]').remove();
}

// a "send us your feedback" CTA sits inside <article>, after the real text
function stripFeedbackWidget($: cheerio.CheerioAPI): void {
  $('[data-tracking-name="feedback-button"]').closest('.feedback').remove();
}

function preprocessDwHtml(html: string): string {
  const $ = cheerio.load(html);
  stripKicker($);
  dedupePublishDate($);
  stripFeedbackWidget($);
  return $.html();
}

export const dwRule: SiteRule = {
  preprocessHtml: preprocessDwHtml,
};
