import { WWW_PREFIX_REGEX } from '../utils';
import type { FeedRule } from './types';

// Only domains whose feeds were measured to carry the whole article body belong
// here. Most feeds ship a teaser: of 14 candidates probed, 11 emitted either no
// content:encoded at all or under a kilobyte of it (Ars Technica's is ~900
// characters, a lede rather than a piece). Registering one of those just buys a
// wasted fetch before the length gate rejects it.
export const FEED_RULES: Record<string, FeedRule> = {
  'bylinetimes.com': { feedUrls: ['https://bylinetimes.com/feed/'] },
  'mashable.com': { feedUrls: ['https://mashable.com/feeds/rss/all'] },
  'pressinsider.com': { feedUrls: ['https://pressinsider.com/feed/'] },
};

export function getFeedRule(url: string): FeedRule | null {
  try {
    const hostname = new URL(url).hostname.replace(WWW_PREFIX_REGEX, '');
    return FEED_RULES[hostname] ?? null;
  } catch {
    return null;
  }
}
