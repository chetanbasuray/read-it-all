import { NextRequest, NextResponse } from 'next/server';
import { scrapeArticle, ScrapeError } from '@/lib/scraper';
import { getCachedArticle, setCachedArticle } from '@/lib/redis';
import { hashUrl, cleanTrackingParams } from '@/lib/utils';
import { normalizeAndValidateUrl } from '@/lib/urlSafety';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, cookies } = body as { url?: string; cookies?: string };

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

    if (!cookies) {
      const cached = await getCachedArticle(canonicalUrl);
      if (cached) {
        return NextResponse.json({
          id: hashUrl(canonicalUrl),
          ...cached,
          cached: true,
        });
      }
    }

    const article = await scrapeArticle(canonicalUrl, cookies);
    if (!cookies) {
      await setCachedArticle(canonicalUrl, { ...article, url: canonicalUrl });
    }

    return NextResponse.json({
      id: hashUrl(canonicalUrl),
      ...article,
      url: canonicalUrl,
      cached: false,
    });
  } catch (error) {
    if (error instanceof ScrapeError) {
      // fallback-chain internals (per-UA HTTP codes, render errors) are for our own debugging, not the end user
      console.error('scrape failed', { message: error.message, details: error.details });
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
