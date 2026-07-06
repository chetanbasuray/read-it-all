import { NextResponse } from 'next/server';

const isRedisConfigured = !!(
  process.env.KV_URL || process.env.KV_REST_API_URL
);

export const dynamic = 'force-dynamic';

export async function GET() {
  let redisOk = false;
  let redisError: string | null = null;

  if (isRedisConfigured) {
    try {
      const { kv } = await import('@vercel/kv');
      await kv.set('health:ping', 'ok', { ex: 60 });
      const result = await kv.get('health:ping');
      redisOk = result === 'ok';
    } catch (e) {
      redisError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    status: redisOk ? 'ok' : isRedisConfigured ? 'degraded' : 'no-redis',
    redis: {
      configured: isRedisConfigured,
      reachable: redisOk,
      error: redisError,
    },
    env: {
      node: process.version,
      platform: process.platform,
    },
  });
}
