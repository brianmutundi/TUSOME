import { NextRequest } from 'next/server';
import { apiError } from '@/lib/server/apiError';
import { isUuid } from '@/lib/analytics/guards';
import { renderPagePdf } from '@/lib/server/pdf';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { tripId: string; studentId: string } }
) {
  const { tripId, studentId } = params;
  if (!isUuid(tripId) || !isUuid(studentId)) {
    return apiError('VALIDATION_ERROR', 'Valid trip and student IDs are required.', { status: 400 });
  }
  return renderPagePdf({
    request,
    path: `/analytics/trips/${tripId}/permission-slip/${studentId}`,
    filename: `permission-slip-${studentId}.pdf`,
  });
}
