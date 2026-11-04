'use client';

import { useEffect, useState } from 'react';
import { getStatementByToken, getFeeStatementByToken } from '@/lib/analytics/api';
import type { StatementByToken } from '@/lib/analytics/api';
import type { FeeStatementRow } from '@/lib/analytics/api';

function formatKES(n: number) {
  return `KES ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PublicStatementPage({ params }: { params: { token: string } }) {
  const [meta, setMeta] = useState<StatementByToken | null>(null);
  const [rows, setRows] = useState<FeeStatementRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const m = await getStatementByToken(params.token);
        setMeta(m);
        const r = await getFeeStatementByToken(params.token);
        setRows(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Invalid or expired link.');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.token]);

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-10"><p className="text-sm text-gray-500">Loading statement…</p></main>;
  if (error || !meta) return <main className="mx-auto max-w-3xl px-4 py-10"><div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error ?? 'Statement not found or link expired.'}</div></main>;

  const { student, school } = meta;
  const termLabel = `${meta.term ?? 'All terms'} • ${meta.academic_year ?? new Date().getFullYear()}`;
  let billed = 0, paid = 0;
  for (const r of rows) {
    if ((r.row_kind === 'fee' || r.row_kind === 'opening') && r.amount > 0) billed += r.amount;
    if (r.row_kind === 'payment') paid += -r.amount;
    if (r.row_kind === 'reversal') paid -= r.amount;
  }
  const outstanding = rows.length ? rows[rows.length - 1].running_balance : 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <a href={`/api/statement/${params.token}/pdf`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Download PDF</a>
        <button onClick={() => window.print()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Print</button>
      </div>
      <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="border-b border-gray-200 pb-4 text-center">
          {school.logo_url && <img src={school.logo_url} alt="logo" className="mx-auto mb-2 h-12 w-auto" />}
          <h1 className="text-xl font-bold">{school.name}</h1>
          {school.motto && <p className="text-sm italic text-gray-600">{school.motto}</p>}
          <p className="text-xs text-gray-500">{[school.county, school.region, school.country].filter(Boolean).join(', ')}</p>
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Fee Statement</p>
          <p className="text-sm">{student.full_name} · {student.admission_no} · {student.class_name ?? ''}</p>
          <p className="text-xs text-gray-500">{termLabel}</p>
        </header>
        <table className="mt-6 w-full text-sm">
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
          </tbody>
        </table>
        <div className="mt-4 text-sm">
          <p><span className="font-semibold">Total billed:</span> {formatKES(billed)}</p>
          <p><span className="font-semibold">Total paid:</span> {formatKES(paid)}</p>
          <p><span className="font-semibold">Outstanding balance:</span> {formatKES(outstanding)}</p>
          <p className="mt-2 text-xs text-gray-500">Generated {new Date().toLocaleString()}</p>
        </div>
      </article>
      <style>{`@media print { @page { size: A4 portrait; margin: 16mm; } .print\\:hidden { display: none !important; } }`}</style>
    </main>
  );
}
