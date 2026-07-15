import { NextRequest, NextResponse } from 'next/server';
import { extractArticle } from '@/lib/scraper';
import { polishArticleForSite } from '@/lib/site-rules';
import { setCachedArticle, getCachedArticle, getArticleViews } from '@/lib/redis';
import { hashUrl, cleanTrackingParams } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface ArticleInput {
  url?: string;
  html?: string;
  title?: string;
  content?: string;
  textContent?: string;
  byline?: string;
  excerpt?: string;
  image?: string;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const { allowed, retryAfterSeconds } = await checkRateLimit(
    `ingest:${getClientIp(request)}`,
    RATE_LIMIT,
    RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429, headers: { ...corsHeaders, 'Retry-After': String(retryAfterSeconds) } },
    );
  }

  try {
    let body: ArticleInput;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('text/plain')) {
      const text = await request.text();
      body = JSON.parse(text);
    } else {
      body = await request.json();
    }

    const { url, html, title, content, textContent, byline, excerpt, image } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'url is required' },
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

    let article: {
      title: string;
      content: string;
      textContent: string;
      excerpt: string;
      byline: string | null;
      image: string | null;
      url: string;
    } | null = null;

    const canonicalUrl = cleanTrackingParams(normalizedUrl);

    if (content && content.length > 200) {
      article = polishArticleForSite({
        title: title || 'Untitled',
        content,
        textContent: textContent || '',
        excerpt: excerpt || (textContent || content.replace(/<[^>]*>/g, '')).substring(0, 200),
        byline: byline || null,
        image: image || null,
        url: canonicalUrl,
      });
    } else if (html && html.length >= 500) {
      article = extractArticle(html, canonicalUrl);
    }

    if (!article) {
      return NextResponse.json(
        { error: 'Could not extract article from the provided data' },
        { status: 422, headers: corsHeaders },
      );
    }

    article.content = sanitizeHtml(article.content);

    const existing = await getCachedArticle(canonicalUrl);
    const id = hashUrl(canonicalUrl);

    if (existing) {
      const views = await getArticleViews(id);
      return NextResponse.json(
        {
          id,
          ...existing,
          cached: true,
          views,
        },
        { headers: corsHeaders },
      );
    }

    await setCachedArticle(canonicalUrl, article);

    return NextResponse.json(
      {
        id,
        ...article,
        cached: false,
        views: 0,
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
