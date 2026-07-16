import { NextRequest, NextResponse } from 'next/server';
import { getAllDomainStats } from '@/lib/domainStats';
import { isAuthorizedAdminRequest } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// internal endpoint (not linked from the UI): surfaces per-domain scrape
// outcomes so frequently-requested, poorly-supported sites can be prioritized
export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const domains = await getAllDomainStats();
  return NextResponse.json({ domains });
}
