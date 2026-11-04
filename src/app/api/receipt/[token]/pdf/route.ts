import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/client';
import { ReceiptDocument } from '@/lib/pdf/receiptDocument';
import type { ReceiptPdfData } from '@/lib/pdf/receiptDocument';

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_receipt_by_token', { p_token: token, p_ip: null });
    if (error) {
      const status = /rate limit/i.test(error.message) ? 429 : 404;
      return NextResponse.json({ error: error.message }, { status });
    }
    const d = data as any;
    const pdfData: ReceiptPdfData = {
      school: d.school,
      receipt: d.receipt,
      payment: d.payment,
      student: d.student,
      balanceRemaining: 0,
      receivedBy: null,
    };
    const buffer = await renderToBuffer(ReceiptDocument({ data: pdfData }));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-${d.receipt.receipt_number}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'PDF generation failed' }, { status: 500 });
  }
}
