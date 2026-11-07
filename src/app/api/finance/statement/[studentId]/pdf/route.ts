import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { apiError, apiErrorFromSupabase } from '@/lib/server/apiError';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseBrowserConfig } from '@/lib/supabase/client';
import { authenticate, getCallerPermissions, hasAnyPermission } from '@/lib/server/auth';
import { StatementDocument } from '@/lib/pdf/statementDocument';

export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const caller = await authenticate(request);
  if (!caller) return apiError('NOT_AUTHENTICATED', 'Sign in required.');

  const perms = await getCallerPermissions(caller);
  if (!hasAnyPermission(perms, ['view-fees', 'manage-fees'])) {
    return apiError('ACCESS_DENIED', 'You do not have permission to view fee statements.');
  }

  const { url, key } = getSupabaseBrowserConfig();
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${caller.accessToken}` } } });

  const term = request.nextUrl.searchParams.get('term') || null;
  const yearParam = request.nextUrl.searchParams.get('year');
  const academicYear = yearParam ? Number(yearParam) : null;

  try {
    const { data: stmtData, error: stmtErr } = await supabase.rpc('get_fee_statement', {
      p_student_id: params.studentId,
      p_term: term,
      p_academic_year: academicYear,
    });
    if (stmtErr) return apiErrorFromSupabase(stmtErr);

    const { data: profileData } = await supabase.rpc('get_school_profile');
    const { data: studentData } = await supabase.from('students').select('full_name,admission_no,class_id').eq('id', params.studentId).single();
    const className = studentData?.class_id ? (await supabase.from('classes').select('name').eq('id', studentData.class_id).single()).data?.name ?? null : null;

    const rows = (Array.isArray(stmtData) ? stmtData : []) as any[];
    let totalBilled = 0, totalPaid = 0;
    for (const r of rows) {
      if (r.row_kind === 'fee' || r.row_kind === 'opening') { if (Number(r.amount) > 0) totalBilled += Number(r.amount); }
      if (r.row_kind === 'payment') totalPaid += -Number(r.amount);
      if (r.row_kind === 'reversal') totalPaid -= Number(r.amount);
    }
    const outstanding = rows.length ? Number(rows[rows.length - 1].running_balance) : 0;

    const pdfData = {
      school: {
        name: profileData?.name ?? 'School',
        motto: profileData?.motto ?? null,
        county: profileData?.county ?? null,
        region: profileData?.region ?? null,
        country: profileData?.country ?? null,
        contact_phone: profileData?.contact_phone ?? null,
        contact_email: profileData?.contact_email ?? null,
      },
      student: { full_name: studentData?.full_name ?? '', admission_no: studentData?.admission_no ?? '', class_name: className },
      term,
      academicYear,
      rows,
      totalBilled,
      totalPaid,
      outstanding,
      generatedAt: new Date().toLocaleString(),
    };

    const buffer = await renderToBuffer(StatementDocument({ data: pdfData as any }));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="fee-statement-${params.studentId}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[api/finance/statement] pdf failed', e);
    return apiError('SERVER_ERROR', 'PDF generation failed.');
  }
}
