import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';
import { bbcRule } from './bbc.com';
import { reutersRule } from './reuters.com';
import { guardianRule } from './theguardian.com';
import { cnnRule } from './cnn.com';
import { toiRule } from './indiatimes.com';
import { toiIsraelRule } from './timesofisrael.com';
import { bylineTimesRule } from './bylinetimes.com';
import { pcmagRule } from './pcmag.com';
import { dailyMailRule } from './dailymail.co.uk';
import { vergeRule } from './theverge.com';
import { hinduRule } from './thehindu.com';
import { moneycontrolRule } from './moneycontrol.com';
import { yahooRule } from './yahoo.com';
import { techSpotRule } from './techspot.com';
import { pravdaRule } from './pravda.com.ua';
import { dwRule } from './dw.com';
import { rteRule } from './rte.ie';
import { arsTechnicaRule } from './arstechnica.com';
import { eurogamerRule } from './eurogamer.net';
import { dexertoRule } from './dexerto.com';
import { cnbcRule } from './cnbc.com';
import { ignRule } from './ign.com';
import { insideEvsRule } from './insideevs.com';

const SITE_RULES: Record<string, SiteRule> = {
  'bbc.com': bbcRule,
  'bbc.co.uk': bbcRule,
  'reuters.com': reutersRule,
  'theguardian.com': guardianRule,
  'cnn.com': cnnRule,
  'edition.cnn.com': cnnRule,
  'timesofindia.indiatimes.com': toiRule,
  'timesofisrael.com': toiIsraelRule,
  'bylinetimes.com': bylineTimesRule,
  'pcmag.com': pcmagRule,
  'dailymail.co.uk': dailyMailRule,
  'dailymail.com': dailyMailRule,
  'theverge.com': vergeRule,
  'thehindu.com': hinduRule,
  'moneycontrol.com': moneycontrolRule,
  'yahoo.com': yahooRule,
  'techspot.com': techSpotRule,
  'pravda.com.ua': pravdaRule,
  'dw.com': dwRule,
  'rte.ie': rteRule,
  'arstechnica.com': arsTechnicaRule,
  'eurogamer.net': eurogamerRule,
  'dexerto.com': dexertoRule,
  'cnbc.com': cnbcRule,
  'ign.com': ignRule,
  'insideevs.com': insideEvsRule,
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
