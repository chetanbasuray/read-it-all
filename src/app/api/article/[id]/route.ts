import { NextRequest, NextResponse } from 'next/server';
import { getArticleById, getArticleViews, incrementArticleViews } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const article = await getArticleById(id);

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found or expired' },
        { status: 404 },
      );
    }

    const views = await getArticleViews(id);

    return NextResponse.json({
      id,
      ...article,
      cached: true,
      views,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const views = await incrementArticleViews(id);
    return NextResponse.json({ views });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
