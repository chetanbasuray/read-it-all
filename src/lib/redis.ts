import { kv } from '@vercel/kv';
import { waitUntil } from '@vercel/functions';
import type { ArticleData } from './scraper';
import { scrapeArticle } from './scraper';
import { hashUrl } from './utils';
import { sanitizeHtml } from './sanitize';

// sliding window: bumped on every read, so popular articles stay cached and cold ones get reclaimed
const CONTENT_TTL = 60 * 60 * 24 * 60;
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

// permanent: lets an expired content entry be recovered by re-scraping the same url under the same id
function getMappingKey(id: string): string {
  return `mapping:${id}`;
}

async function touchTtl(url: string): Promise<void> {
  try {
    await kv.expire(getCacheKey(url), CONTENT_TTL);
  } catch {
    // best-effort; a failed bump just means this entry may expire a bit early
  }
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
    if (article) {
      waitUntil(touchTtl(article.url));
      waitUntil(refreshIfStale(article));
    }
    return article;
  } catch {
    return null;
  }
}

export async function setCachedArticle(url: string, article: ArticleData): Promise<void> {
  if (!isRedisConfigured) return;
  try {
    const id = hashUrl(url);
    const sanitized: CachedArticle = { ...article, content: sanitizeHtml(article.content), scrapedAt: Date.now() };
    await kv.set(`article:${id}`, sanitized, { ex: CONTENT_TTL });
    await kv.set(getMappingKey(id), { url });
  } catch {
    // Cache failure is non-critical
  }
}

// unlike getCachedArticle, always scrapes even if a cache entry exists, and
// resets scrapedAt so the sliding staleness window restarts from now
export async function forceRescrapeArticle(url: string): Promise<ArticleData> {
  try {
    const fresh = await scrapeArticle(url);
    await setCachedArticle(url, fresh);
    return fresh;
  } catch (error) {
    // the whole point of a forced rescrape is "the cached content is known
    // wrong"; if a fresh scrape can't replace it, keeping the old content
    // around would silently keep serving that same known-wrong content
    await evictCachedArticle(url);
    throw error;
  }
}

async function evictCachedArticle(url: string): Promise<void> {
  if (!isRedisConfigured) return;
  try {
    await kv.del(getCacheKey(url));
  } catch {
    // best-effort; a failed eviction just means the stale entry lives until its TTL
  }
}

export async function getArticleById(id: string): Promise<ArticleData | null> {
  if (!isRedisConfigured) return null;
  try {
    const article = await kv.get<CachedArticle>(`article:${id}`);
    if (article) {
      waitUntil(touchTtl(article.url));
      waitUntil(refreshIfStale(article));
    }
    return article;
  } catch {
    return null;
  }
}

// survives content eviction, so an expired link can be silently re-scraped under the same id
export async function getUrlForId(id: string): Promise<string | null> {
  if (!isRedisConfigured) return null;
  try {
    const mapping = await kv.get<{ url: string }>(getMappingKey(id));
    return mapping?.url ?? null;
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
