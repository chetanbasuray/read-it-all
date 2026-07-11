import { NextRequest, NextResponse } from 'next/server';
import { getArticleById, getArticleViews, incrementArticleViews } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const article = await getArticleById(params.id);

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found or expired' },
        { status: 404 },
      );
    }

    const views = await incrementArticleViews(params.id);

    return NextResponse.json({
      id: params.id,
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
