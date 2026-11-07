import { NextRequest } from 'next/server';
import { apiError } from '@/lib/server/apiError';
import { authenticate, getCallerPermissions, hasAnyPermission } from '@/lib/server/auth';
import { isUuid } from '@/lib/analytics/guards';
import { renderPagePdf } from '@/lib/server/pdf';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { receiptId: string } }
) {
  const caller = await authenticate(request);
  if (!caller) return apiError('NOT_AUTHENTICATED', 'Sign in required.');

  const perms = await getCallerPermissions(caller);
  if (!hasAnyPermission(perms, ['view-fees', 'manage-fees', 'access-printouts'])) {
    return apiError('ACCESS_DENIED', 'You do not have permission to view receipts.');
  }

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
