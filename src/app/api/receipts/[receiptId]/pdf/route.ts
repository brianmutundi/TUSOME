import { NextRequest } from 'next/server';
import { apiError } from '@/lib/server/apiError';
import { isUuid } from '@/lib/analytics/guards';
import { renderPagePdf } from '@/lib/server/pdf';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { receiptId: string } }
) {
  const { receiptId } = params;
  if (!isUuid(receiptId)) {
    return apiError('VALIDATION_ERROR', 'A valid receipt ID is required.', { status: 400 });
  }
  return renderPagePdf({
    request,
    path: `/analytics/receipts/${receiptId}`,
    filename: `receipt-${receiptId}.pdf`,
  });
}
