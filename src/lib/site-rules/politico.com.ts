import * as cheerio from 'cheerio';
import { regex } from 'shorol';
import type { SiteRule } from './types';

// a separate frontend from politico.eu's rule: Tailwind utilities instead of
// semantic classes, so these key off structure and off styling that occurs
// exactly once in the header
const BYLINE_SPAN_REGEX = regex().start().literal('By').whitespace().oneOrMore().toRegExp();

const NETWORK_BOILERPLATE_REGEX = regex().literal('Axel Springer Global Reporters Network').toRegExp();

function stripHeaderChrome($: cheerio.CheerioAPI): void {
  // the dek follows the headline and is already the reader's excerpt
  $('h1').first().next('p').remove();

  // in-body photos use a real <figcaption>, so this border-styled paragraph is
  // only ever the lead caption, and it sits outside <figure> where the
  // duplicate-lead-image strip cannot reach it
  $('p.border-b').remove();

  // the reader renders its own byline and date, so these are metadata, not text
  $('time').remove();
  $('p.italic').first().remove();
}

function stripBylineSpan($: cheerio.CheerioAPI): void {
  $('span')
    .filter((_, el) => {
      const text = $(el).text().trim();
      return text.length < 60 && BYLINE_SPAN_REGEX.test(text);
    })
    .remove();
}

function stripNetworkBoilerplate($: cheerio.CheerioAPI): void {
  $('p')
    .filter((_, el) => NETWORK_BOILERPLATE_REGEX.test($(el).text()))
    .remove();
}

function preprocessPoliticoComHtml(html: string): string {
  const $ = cheerio.load(html);
  stripHeaderChrome($);
  stripBylineSpan($);
  stripNetworkBoilerplate($);
  return $.html();
}

export const politicoComRule: SiteRule = {
  preprocessHtml: preprocessPoliticoComHtml,
};
