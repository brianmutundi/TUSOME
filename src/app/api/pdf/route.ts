import { NextRequest, NextResponse } from 'next/server';
import { renderPagePdf } from '@/lib/server/pdf';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path');
  const filename = request.nextUrl.searchParams.get('filename') || 'document.pdf';
  if (!path || !path.startsWith('/')) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }
  return renderPagePdf({ request, path, filename });
}