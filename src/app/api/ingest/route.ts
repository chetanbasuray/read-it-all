import { NextRequest, NextResponse } from 'next/server';
import {
  parseWithReadability,
  extractFromJsonLd,
  extractFirstImage,
  extractTitle,
  extractAuthor,
} from '@/lib/scraper';
import { setCachedArticle } from '@/lib/redis';
import { hashUrl } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    let body: { url?: string; html?: string };

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('text/plain')) {
      const text = await request.text();
      body = JSON.parse(text);
    } else {
      body = await request.json();
    }
    const { url, html } = body as { url?: string; html?: string };

    if (!url || !html) {
      return NextResponse.json(
        { error: 'Both url and html are required' },
        { status: 400, headers: corsHeaders },
      );
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = new URL(url).href;
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400, headers: corsHeaders },
      );
    }

    if (html.length < 500) {
      return NextResponse.json(
        { error: 'HTML content is too short' },
        { status: 400, headers: corsHeaders },
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
        { status: 422, headers: corsHeaders },
      );
    }

    await setCachedArticle(normalizedUrl, article);

    return NextResponse.json(
      {
        id: hashUrl(normalizedUrl),
        ...article,
        cached: false,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders },
    );
  }
}
