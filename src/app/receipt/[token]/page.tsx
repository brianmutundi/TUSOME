'use client';

import { useEffect, useState } from 'react';
import { getReceiptByToken } from '@/lib/analytics/api';
import type { ReceiptByToken } from '@/lib/analytics/api';

function formatKES(n: number) {
  return `KES ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PublicReceiptPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<ReceiptByToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [thermal, setThermal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setThermal(params.get('format') === 'thermal');
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await getReceiptByToken(params.token);
        setData(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Invalid or expired link.');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.token]);

  if (loading) return <main className="mx-auto max-w-2xl px-4 py-10"><p className="text-sm text-gray-500">Loading receipt…</p></main>;
  if (error || !data) return <main className="mx-auto max-w-2xl px-4 py-10"><div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error ?? 'Receipt not found or link expired.'}</div></main>;

  const { receipt, payment, student, school } = data;
  const termLabel = `${payment.term ?? 'Term 1'} • ${payment.academic_year ?? new Date().getFullYear()}`;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <a href={`/api/receipt/${params.token}/pdf`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Download PDF</a>
        <button onClick={() => window.print()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Print</button>
      </div>
      <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="border-b border-gray-200 pb-4 text-center">
          {school.logo_url && <img src={school.logo_url} alt="School logo" className="mx-auto mb-2 h-12 w-auto" loading="lazy" />}
          <h1 className="text-xl font-bold">{school.name}</h1>
          {school.motto && <p className="text-sm italic text-gray-600">{school.motto}</p>}
          <p className="text-xs text-gray-500">{[school.county, school.region, school.country].filter(Boolean).join(', ')}</p>
          <p className="text-xs text-gray-500">{school.contact_phone && `Tel: ${school.contact_phone}`} {school.contact_email && `Email: ${school.contact_email}`}</p>
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Receipt</p>
        </header>
        <section className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div><span className="font-semibold">Receipt No.:</span> {receipt.receipt_number}</div>
          <div><span className="font-semibold">Date/Time:</span> {new Date(receipt.paid_at).toLocaleString()}</div>
          <div><span className="font-semibold">Student:</span> {student.full_name}</div>
          <div><span className="font-semibold">Adm No.:</span> {student.admission_no}</div>
          <div><span className="font-semibold">Grade:</span> {student.class_name ?? '—'}</div>
          <div><span className="font-semibold">Term:</span> {termLabel}</div>
          <div><span className="font-semibold">Amount paid:</span> {formatKES(receipt.amount_paid)}</div>
          <div><span className="font-semibold">Method:</span> {receipt.payment_method}</div>
          <div><span className="font-semibold">Reference:</span> {receipt.reference_number ?? '—'}</div>
          <div><span className="font-semibold">Paid by:</span> {payment.paid_by ?? '—'}</div>
          <div><span className="font-semibold">Received by:</span> —</div>
        </section>
      </article>
      <style>{`@media print { @page { size: ${thermal ? '80mm auto' : 'A4 portrait'}; margin: ${thermal ? '4mm' : '16mm'}; } .print\\:hidden { display: none !important; } }`}</style>
    </main>
  );
}
