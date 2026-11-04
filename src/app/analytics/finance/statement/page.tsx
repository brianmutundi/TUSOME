'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, CardHeader, LoadingPanel, SelectField } from '@/components/ui';
import { getFeeStatement, getStudentGuardianContacts, logMessage, createStatementShareToken } from '@/lib/analytics/api';
import type { FeeStatementRow } from '@/lib/analytics/api';
import { SchoolHeader } from '@/components/documents/SchoolHeader';
import { describeAnalyticsError, getStudentDirectory, isAbortError } from '@/lib/analytics/api';
import type { StudentDirectoryRow } from '@/lib/analytics/types';
import { buildStatementSms, normalizePhoneKE } from '@/lib/finance/receiptSms';

function formatKES(n: number) {
  return `KES ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FeeStatementPage() {
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [term, setTerm] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [rows, setRows] = useState<FeeStatementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // read query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('student');
    const t = params.get('term');
    const y = params.get('year');
    if (s) setSelectedStudent(s);
    if (t) setTerm(t);
    if (y) setYear(y);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getStudentDirectory(undefined, undefined, undefined, undefined, { signal: controller.signal })
      .then((s) => { if (active) setStudents(s); })
      .catch(() => {});
    return () => { active = false; controller.abort(); };
  }, []);

  const load = async () => {
    if (!selectedStudent) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFeeStatement(selectedStudent, term || undefined, year ? Number(year) : undefined);
      setRows(data);
    } catch (e) {
      setError(describeAnalyticsError(e, 'Could not load statement.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (selectedStudent) load(); /* eslint-disable-next-line */ }, [selectedStudent, term, year]);

  const totals = useMemo(() => {
    let billed = 0, paid = 0;
    for (const r of rows) {
      if (r.row_kind === 'fee' || r.row_kind === 'opening') {
        if (r.amount > 0) billed += r.amount;
      }
      if (r.row_kind === 'payment') paid += -r.amount;
      if (r.row_kind === 'reversal') paid -= r.amount;
    }
    const outstanding = rows.length ? rows[rows.length - 1].running_balance : 0;
    return { billed, paid, outstanding };
  }, [rows]);

  const handleDownloadPdf = async () => {
    try {
      const { data } = await (await import('@/lib/supabase/client')).createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session expired. Sign in again.');
      const res = await fetch(`/api/finance/statement/${selectedStudent}/pdf?term=${encodeURIComponent(term)}&year=${encodeURIComponent(year)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fee-statement-${selectedStudent}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setActionError(describeAnalyticsError(e, 'Could not download PDF.'));
    }
  };

  const handleSms = async () => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const guardians = await getStudentGuardianContacts(selectedStudent);
      const phone = guardians.find((g) => g.guardian_phone)?.guardian_phone;
      if (!phone) { setActionError('No guardian phone on file.'); return; }
      const norm = normalizePhoneKE(phone);
      if (!norm) { setActionError('Invalid phone number.'); return; }
      const token = await createStatementShareToken(selectedStudent, term || undefined, year ? Number(year) : undefined, 7);
      const link = `${window.location.origin}/statement/${token}`;
      const message = buildStatementSms({
        studentName: students.find((s) => s.student_id === selectedStudent)?.full_name ?? 'Student',
        billed: totals.billed,
        paid: totals.paid,
        outstanding: totals.outstanding,
        link,
      });
      await logMessage('specific_students', [selectedStudent], 'text', 'Fee statement', message, [norm], 1, 1);
      setActionSuccess('SMS queued for sending.');
    } catch (e) {
      setActionError(describeAnalyticsError(e, 'Could not send SMS.'));
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          <Link href="/analytics/finance" className="text-blue-700 hover:underline">Finance</Link> / Fee Statement
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Fee Statement</h1>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      <Card>
        <div className="flex flex-wrap gap-3 p-4">
          <SelectField id="stmt-student" label="Student" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
            <option value="">Select a student</option>
            {students.map((s) => <option key={s.student_id} value={s.student_id}>{s.admission_no} — {s.full_name}</option>)}
          </SelectField>
          <SelectField id="stmt-term" label="Term" value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="">All terms</option>
            <option value="Term 1">Term 1</option>
            <option value="Term 2">Term 2</option>
            <option value="Term 3">Term 3</option>
          </SelectField>
          <SelectField id="stmt-year" label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All years</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </SelectField>
        </div>
      </Card>

      {loading && <LoadingPanel label="Loading statement…" />}
      {error && <div className="mt-4"><Alert tone="error" title="Could not load">{error}</Alert></div>}

      {!loading && selectedStudent && (
        <Card className="mt-4">
          <div className="p-4">
            <SchoolHeader title="Fee Statement" />
            <div className="mb-4 flex justify-end gap-2 no-print">
              <Button variant="secondary" onClick={() => window.print()}>Print</Button>
              <Button variant="secondary" onClick={handleDownloadPdf}>Download PDF</Button>
              <Button variant="secondary" onClick={handleSms}>SMS link</Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2">Term</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2 text-right">Balance</th>
                  <th className="px-2 py-2">Receipt</th>
                  <th className="px-2 py-2">Paid by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${r.row_kind === 'reversal' ? 'line-through text-gray-400' : ''}`}>
                    <td className="px-2 py-2">{r.occurred_at ? new Date(r.occurred_at).toLocaleDateString() : '—'}</td>
                    <td className="px-2 py-2">{r.description ?? '—'}</td>
                    <td className="px-2 py-2">{r.term ?? '—'}</td>
                    <td className="px-2 py-2 text-right">{formatKES(r.amount)}</td>
                    <td className="px-2 py-2 text-right">{formatKES(r.running_balance)}</td>
                    <td className="px-2 py-2">{r.receipt_number ?? '—'}</td>
                    <td className="px-2 py-2">{r.paid_by ?? '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-2 py-6 text-center text-gray-500">No entries.</td></tr>
                )}
              </tbody>
            </table>
            <div className="mt-4 text-sm">
              <p><span className="font-semibold">Total billed:</span> {formatKES(totals.billed)}</p>
              <p><span className="font-semibold">Total paid:</span> {formatKES(totals.paid)}</p>
              <p><span className="font-semibold">{totals.outstanding < 0 ? 'Credit balance:' : 'Outstanding balance:'}</span> {formatKES(Math.abs(totals.outstanding))}</p>
              <p className="mt-2 text-xs text-gray-500">Generated {new Date().toLocaleString()}</p>
            </div>
          </div>
        </Card>
      )}
      <style>{`@media print { @page { size: A4 portrait; margin: 16mm; } .no-print { display: none !important; } }`}</style>
    </main>
  );
}
