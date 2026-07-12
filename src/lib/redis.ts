import { kv } from '@vercel/kv';
import { waitUntil } from '@vercel/functions';
import type { ArticleData } from './scraper';
import { scrapeArticle } from './scraper';
import { hashUrl } from './utils';
import { sanitizeHtml } from './sanitize';

// long enough that a shared link effectively never expires, while still bounding storage for content nobody revisits
const CACHE_TTL = 60 * 60 * 24 * 365;
// how old a cached scrape can get before a visit triggers a background re-scrape
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
// short-lived distributed lock so concurrent visits to the same stale article don't all trigger a re-scrape
const REFRESH_LOCK_TTL = 60;

interface CachedArticle extends ArticleData {
  scrapedAt: number;
}

const isRedisConfigured = !!(
  process.env.KV_URL || process.env.KV_REST_API_URL
);

export function getCacheKey(url: string): string {
  return `article:${hashUrl(url)}`;
}

export async function refreshIfStale(article: CachedArticle): Promise<void> {
  if (typeof article.scrapedAt === 'number' && Date.now() - article.scrapedAt < STALE_THRESHOLD_MS) {
    return;
  }

  const lockKey = `refreshing:${hashUrl(article.url)}`;
  const acquired = await kv.set(lockKey, '1', { nx: true, ex: REFRESH_LOCK_TTL });
  if (!acquired) return;

  try {
    const fresh = await scrapeArticle(article.url);
    await setCachedArticle(article.url, fresh);
  } catch {
    // stale copy keeps serving; the lock expiring lets the next visit retry
  }
}

export async function getCachedArticle(url: string): Promise<ArticleData | null> {
  if (!isRedisConfigured) return null;
  try {
    const key = getCacheKey(url);
    const article = await kv.get<CachedArticle>(key);
    if (article) waitUntil(refreshIfStale(article));
    return article;
  } catch {
    return null;
  }
}

export async function setCachedArticle(url: string, article: ArticleData): Promise<void> {
  if (!isRedisConfigured) return;
  try {
    const key = getCacheKey(url);
    const sanitized: CachedArticle = { ...article, content: sanitizeHtml(article.content), scrapedAt: Date.now() };
    await kv.set(key, sanitized, { ex: CACHE_TTL });
  } catch {
    // Cache failure is non-critical
  }
}

export async function getArticleById(id: string): Promise<ArticleData | null> {
  if (!isRedisConfigured) return null;
  try {
    const article = await kv.get<CachedArticle>(`article:${id}`);
    if (article) waitUntil(refreshIfStale(article));
    return article;
  } catch {
    return null;
  }
}

export async function getArticleViews(id: string): Promise<number> {
  if (!isRedisConfigured) return 0;
  try {
    const views = await kv.get<number>(`views:${id}`);
    return views ?? 0;
  } catch {
    return 0;
  }
}

export async function incrementArticleViews(id: string): Promise<number> {
  if (!isRedisConfigured) return 0;
  try {
    return await kv.incr(`views:${id}`);
  } catch {
    return 0;
  }
}
