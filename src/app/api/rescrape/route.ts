import { NextRequest, NextResponse } from 'next/server';
import { ScrapeError } from '@/lib/scraper';
import { forceRescrapeArticle, evictCachedArticle } from '@/lib/redis';
import { cleanTrackingParams, hashUrl } from '@/lib/utils';
import { normalizeAndValidateUrl } from '@/lib/urlSafety';
import { isAuthorizedAdminRequest } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// internal endpoint (not linked from the UI) to force a fresh scrape and reset
// a cached article's TTL even though a cache entry already exists, for fixing
// an article that was cached before a scraping/site-rule fix shipped
export async function POST(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url, evictOnly } = body as { url?: string; evictOnly?: boolean };

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

    // for takedown requests: removes the cache entry without attempting to
    // replace it with a fresh scrape, unlike a normal rescrape
    if (evictOnly) {
      await evictCachedArticle(canonicalUrl);
      return NextResponse.json({ evicted: true, url: canonicalUrl });
    }

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
