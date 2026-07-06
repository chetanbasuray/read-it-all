import { NextRequest, NextResponse } from 'next/server';
import { parseWithReadability, extractFromJsonLd, extractFirstImage, extractTitle, extractAuthor } from '@/lib/scraper';
import { setCachedArticle } from '@/lib/redis';
import { hashUrl } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, html } = body as { url?: string; html?: string };

    if (!url || !html) {
      return NextResponse.json(
        { error: 'Both url and html are required' },
        { status: 400 },
      );
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = new URL(url).href;
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (html.length < 500) {
      return NextResponse.json(
        { error: 'HTML content is too short' },
        { status: 400 },
      );
    }

    const article =
      parseWithReadability(html, normalizedUrl) ||
      (() => {
        const jsonld = extractFromJsonLd(html);
        if (jsonld && jsonld.content && jsonld.content.length > 200) {
          return {
            title: jsonld.title || 'Untitled',
            content: jsonld.content,
            textContent: jsonld.textContent || '',
            excerpt: jsonld.textContent?.substring(0, 200) || '',
            byline: jsonld.byline || extractAuthor(html) || null,
            image: jsonld.image || extractFirstImage(html),
            url: normalizedUrl,
          };
        }
        return null;
      })();

    if (!article) {
      return NextResponse.json(
        { error: 'Could not extract article from the provided HTML' },
        { status: 422 },
      );
    }

    await setCachedArticle(normalizedUrl, article);

    return NextResponse.json({
      id: hashUrl(normalizedUrl),
      ...article,
      cached: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
