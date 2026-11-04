'use client';

import { useEffect, useState } from 'react';
import { getReceiptByToken } from '@/lib/analytics/api';
import type { ReceiptByToken } from '@/lib/analytics/api';
import { ReceiptView, type ReceiptViewData } from '@/components/finance/ReceiptView';

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

  const receiptViewData: ReceiptViewData = {
    school,
    receiptNumber: receipt.receipt_number,
    paidAt: receipt.paid_at,
    studentName: student.full_name,
    admissionNo: student.admission_no,
    className: student.class_name,
    term: payment.term,
    academicYear: payment.academic_year,
    amountPaid: receipt.amount_paid,
    method: receipt.payment_method,
    reference: receipt.reference_number,
    paidBy: payment.paid_by,
    receivedBy: null,
    balanceRemaining: null,
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <a href={`/api/receipt/${params.token}/pdf`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Download PDF</a>
        <button onClick={() => window.print()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Print</button>
      </div>
      <ReceiptView data={receiptViewData} variant="card" />
      <style>{`@media print { @page { size: ${thermal ? '80mm auto' : 'A4 portrait'}; margin: ${thermal ? '4mm' : '16mm'}; } .print\\:hidden { display: none !important; } }`}</style>
    </main>
  );
}
