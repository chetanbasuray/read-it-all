import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ScrapeError } from '@/lib/scraper';
import { forceRescrapeArticle } from '@/lib/redis';
import { cleanTrackingParams, hashUrl } from '@/lib/utils';
import { normalizeAndValidateUrl } from '@/lib/urlSafety';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const token = process.env.RESCRAPE_TOKEN;
  if (!token) return false;

  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// internal endpoint (not linked from the UI) to force a fresh scrape and reset
// a cached article's TTL even though a cache entry already exists, for fixing
// an article that was cached before a scraping/site-rule fix shipped
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = await normalizeAndValidateUrl(url);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'URL validation failed' },
        { status: 400 },
      );
    }

    const canonicalUrl = cleanTrackingParams(normalizedUrl);
    const article = await forceRescrapeArticle(canonicalUrl);

    return NextResponse.json({
      id: hashUrl(canonicalUrl),
      ...article,
      url: canonicalUrl,
    });
  } catch (error) {
    if (error instanceof ScrapeError) {
      console.error('rescrape failed', { message: error.message, details: error.details });
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
