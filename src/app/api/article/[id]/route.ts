import { NextRequest, NextResponse } from 'next/server';
import { getArticleById } from '@/lib/redis';

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

    return NextResponse.json({
      id: params.id,
      ...article,
      cached: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
