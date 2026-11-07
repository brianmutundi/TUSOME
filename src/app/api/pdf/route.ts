import { NextRequest } from 'next/server';
import { apiError } from '@/lib/server/apiError';
import { renderPagePdf } from '@/lib/server/pdf';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path');
  const filename = request.nextUrl.searchParams.get('filename') || 'document.pdf';
  if (!path || !path.startsWith('/')) {
    return apiError('VALIDATION_ERROR', 'A page path is required.', { status: 400 });
  }
  return renderPagePdf({ request, path, filename });
}