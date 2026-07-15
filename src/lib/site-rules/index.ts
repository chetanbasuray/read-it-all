import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';
import { bbcRule } from './bbc.com';
import { reutersRule } from './reuters.com';
import { guardianRule } from './theguardian.com';
import { cnnRule } from './cnn.com';

const SITE_RULES: Record<string, SiteRule> = {
  'bbc.com': bbcRule,
  'bbc.co.uk': bbcRule,
  'reuters.com': reutersRule,
  'theguardian.com': guardianRule,
  'cnn.com': cnnRule,
  'edition.cnn.com': cnnRule,
};

function getSiteRule(url: string): SiteRule | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return SITE_RULES[hostname] ?? null;
  } catch {
    return null;
  }
}

export function preprocessHtmlForSite(url: string, html: string): string {
  const rule = getSiteRule(url);
  return rule?.preprocessHtml ? rule.preprocessHtml(html) : html;
}

export function polishArticleForSite(article: ArticleData): ArticleData {
  const rule = getSiteRule(article.url);
  return rule?.polishArticle ? rule.polishArticle(article) : article;
}
