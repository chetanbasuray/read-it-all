import { kv } from '@vercel/kv';
import type { ArticleData } from './scraper';
import { hashUrl } from './utils';

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
    await kv.set(key, article, { ex: CACHE_TTL });
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
