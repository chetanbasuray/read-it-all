import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/adminAuth';
import { listCachedArticles } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

// internal endpoint (not linked from the UI) that enumerates what is cached, so
// a re-extraction sweep can be driven from outside without handing out KV creds
export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const cursor = params.get('cursor') ?? '0';
  const requested = Number.parseInt(params.get('limit') ?? '', 10);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const page = await listCachedArticles(cursor, limit);
    return NextResponse.json(page);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Listing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
