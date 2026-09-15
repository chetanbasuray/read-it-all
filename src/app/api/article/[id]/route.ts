import { NextRequest, NextResponse } from 'next/server';
import { getArticleById, getArticleViews, incrementArticleViews, isArticleEvicted } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const article = await getArticleById(params.id);

    if (!article) {
      // 410 rather than 404: a tombstoned id is gone on purpose (takedown),
      // and callers polling after an eviction need to see the difference
      // from an entry that merely expired and can be re-scraped
      if (await isArticleEvicted(params.id)) {
        return NextResponse.json(
          { error: 'This article was removed and is no longer available.' },
          { status: 410 },
        );
      }
      return NextResponse.json(
        { error: 'Article not found or expired' },
        { status: 404 },
      );
    }

    const views = await getArticleViews(params.id);

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

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const views = await incrementArticleViews(params.id);
    return NextResponse.json({ views });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
