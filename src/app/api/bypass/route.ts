import { NextRequest, NextResponse } from 'next/server';
import { scrapeArticle, ScrapeError } from '@/lib/scraper';
import { getCachedArticle, setCachedArticle } from '@/lib/redis';
import { hashUrl } from '@/lib/utils';
import { validateUrl } from '@/lib/urlSafety';

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
      normalizedUrl = new URL(url).href;
    } catch {
      return NextResponse.json({ error: 'Invalid URL provided' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(new URL(normalizedUrl).protocol)) {
      return NextResponse.json({ error: 'Only http and https URLs are supported' }, { status: 400 });
    }

    try {
      await validateUrl(normalizedUrl);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'URL validation failed' },
        { status: 400 },
      );
    }

    if (!cookies) {
      const cached = await getCachedArticle(normalizedUrl);
      if (cached) {
        return NextResponse.json({
          id: hashUrl(normalizedUrl),
          ...cached,
          cached: true,
        });
      }
    }

    const article = await scrapeArticle(normalizedUrl, cookies);
    if (!cookies) {
      await setCachedArticle(normalizedUrl, article);
    }

    return NextResponse.json({
      id: hashUrl(normalizedUrl),
      ...article,
      cached: false,
    });
  } catch (error) {
    if (error instanceof ScrapeError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 502 },
      );
    }
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
