import { regex } from 'shorol';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

// the byline sits in a p.time block that also carries the timestamp, as
// "By Ajit Dubey |\n Updated: Aug 06, 2026 18:24 IST"; Readability keeps the
// leading "By" and the separator pipe the reader UI adds for itself
const BY_PREFIX_REGEX = regex().start().literal('By').whitespace().oneOrMore().toRegExp('i');
const TRAILING_SEPARATOR_REGEX = regex()
  .whitespace()
  .zeroOrMore()
  .literal('|')
  .whitespace()
  .zeroOrMore()
  .end()
  .toRegExp();

function cleanByline(byline: string | null): string | null {
  if (!byline) return byline;
  const cleaned = byline.replace(BY_PREFIX_REGEX, '').replace(TRAILING_SEPARATOR_REGEX, '').trim();
  return cleaned || byline;
}

function polishAniArticle(article: ArticleData): ArticleData {
  return { ...article, byline: cleanByline(article.byline) };
}

export const aniNewsRule: SiteRule = {
  polishArticle: polishAniArticle,
};
