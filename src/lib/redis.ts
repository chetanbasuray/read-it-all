import { kv } from '@vercel/kv';
import type { ArticleData } from './scraper';
import { hashUrl } from './utils';
import { sanitizeHtml } from './sanitize';

const CACHE_TTL = 60 * 60 * 24;

const isRedisConfigured = !!(
  process.env.KV_URL || process.env.KV_REST_API_URL
);

export function getCacheKey(url: string): string {
  return `article:${hashUrl(url)}`;
}

export async function getCachedArticle(url: string): Promise<ArticleData | null> {
  if (!isRedisConfigured) return null;
  try {
    const key = getCacheKey(url);
    return await kv.get<ArticleData>(key);
  } catch {
    return null;
  }
}

export async function setCachedArticle(url: string, article: ArticleData): Promise<void> {
  if (!isRedisConfigured) return;
  try {
    const key = getCacheKey(url);
    const sanitized = { ...article, content: sanitizeHtml(article.content) };
    await kv.set(key, sanitized, { ex: CACHE_TTL });
  } catch {
    // Cache failure is non-critical
  }
}

export async function getArticleById(id: string): Promise<ArticleData | null> {
  if (!isRedisConfigured) return null;
  try {
    return await kv.get<ArticleData>(`article:${id}`);
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
