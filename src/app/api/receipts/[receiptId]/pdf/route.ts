import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/analytics/guards';
import { renderPagePdf } from '@/lib/server/pdf';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { receiptId: string } }
) {
  const { receiptId } = params;
  if (!isUuid(receiptId)) {
    return NextResponse.json({ error: 'Valid receipt ID required' }, { status: 400 });
  }
  return renderPagePdf({
    request,
    path: `/analytics/receipts/${receiptId}`,
    filename: `receipt-${receiptId}.pdf`,
  });
}
