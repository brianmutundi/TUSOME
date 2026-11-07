import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { apiError } from '@/lib/server/apiError';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseBrowserConfig } from '@/lib/supabase/client';
import { StatementDocument } from '@/lib/pdf/statementDocument';

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const { url, key } = getSupabaseBrowserConfig();
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: meta, error: metaErr } = await supabase.rpc('get_statement_by_token', { p_token: params.token, p_ip: null });
    if (metaErr) return apiError('NOT_FOUND', 'Statement not found or link has expired.');
    const { data: rows, error: rowsErr } = await supabase.rpc('get_fee_statement_by_token', { p_token: params.token, p_ip: null });
    if (rowsErr) return apiError('NOT_FOUND', 'Statement not found or link has expired.');

    const r = (Array.isArray(rows) ? rows : []) as any[];
    let totalBilled = 0, totalPaid = 0;
    for (const x of r) {
      if ((x.row_kind === 'fee' || x.row_kind === 'opening') && Number(x.amount) > 0) totalBilled += Number(x.amount);
      if (x.row_kind === 'payment') totalPaid += -Number(x.amount);
      if (x.row_kind === 'reversal') totalPaid -= Number(x.amount);
    }
    const outstanding = r.length ? Number(r[r.length - 1].running_balance) : 0;

    const pdfData = {
      school: meta.school,
      student: meta.student,
      term: meta.term,
      academicYear: meta.academic_year,
      rows: r,
      totalBilled,
      totalPaid,
      outstanding,
      generatedAt: new Date().toLocaleString(),
    };

    const buffer = await renderToBuffer(StatementDocument({ data: pdfData as any }));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="fee-statement.pdf"`,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (e) {
    console.error('[api/statement] pdf failed', e);
    return apiError('SERVER_ERROR', 'PDF generation failed.');
  }
}
