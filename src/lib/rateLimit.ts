import { kv } from '@vercel/kv';
import type { NextRequest } from 'next/server';

const isRedisConfigured = !!(process.env.KV_URL || process.env.KV_REST_API_URL);

// Vercel's edge network always sets this; the first entry is the original
// client, any further ones are intermediate proxies
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// fixed-window counter: one INCR plus a one-time EXPIRE per window, using the
// same Redis already in place for article caching rather than a new service
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!isRedisConfigured) return { allowed: true, retryAfterSeconds: 0 };

  const nowSeconds = Math.floor(Date.now() / 1000);
  const window = Math.floor(nowSeconds / windowSeconds);
  const bucketKey = `ratelimit:${key}:${window}`;
  const retryAfterSeconds = windowSeconds - (nowSeconds % windowSeconds);

  try {
    const count = await kv.incr(bucketKey);
    if (count === 1) {
      await kv.expire(bucketKey, windowSeconds);
    }
    return { allowed: count <= limit, retryAfterSeconds };
  } catch {
    // fail open: a Redis outage should degrade to "no rate limiting", not take the app down
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
