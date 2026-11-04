'use client';

import { formatKes } from '@/lib/format-kes';
import type { SchoolProfile } from '@/lib/analytics/types';

export interface ReceiptViewData {
  school: Pick<
    SchoolProfile,
    'name' | 'motto' | 'county' | 'region' | 'country' | 'contact_phone' | 'contact_email' | 'logo_url'
  > | null;
  receiptNumber: string;
  paidAt: string;
  studentName: string;
  admissionNo: string;
  className: string | null;
  term: string | null;
  academicYear: number | null;
  amountPaid: number;
  method: string;
  reference: string | null;
  paidBy: string | null;
  receivedBy: string | null;
  balanceRemaining?: number | null;
}

export function receiptViewTermLabel(term: string | null, year: number | null): string {
  const t = term ? term : 'Term 1';
  const y = year ?? new Date().getFullYear();
  return `${t} • ${y}`;
}

const CARD_CLASS = 'rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10';

/**
 * Single receipt view used by the staff receipt modal and the public receipt
 * page. The PDF renderer (src/lib/pdf/receiptDocument.tsx) is react-pdf-native
 * and consumes the same ReceiptViewData; the printed output mirrors this view.
 */
export function ReceiptView({ data, variant = 'card' }: { data: ReceiptViewData; variant?: 'card' | 'plain' }) {
  const termLabel = receiptViewTermLabel(data.term, data.academicYear);
  const fields: Array<[string, string]> = [
    ['Receipt No.:', data.receiptNumber || '—'],
    ['Date/Time:', new Date(data.paidAt).toLocaleString()],
    ['Student:', data.studentName],
    ['Adm No.:', data.admissionNo],
    ['Grade:', data.className ?? '—'],
    ['Term:', termLabel],
    ['Amount paid:', formatKes(data.amountPaid)],
    ['Method:', data.method],
    ['Reference:', data.reference ?? '—'],
    ['Paid by:', data.paidBy ?? '—'],
  ];
  if (data.balanceRemaining != null) {
    fields.push(['Balance remaining:', formatKes(data.balanceRemaining)]);
  }
  fields.push(['Received by:', data.receivedBy ?? '—']);

  return (
    <article className={variant === 'card' ? CARD_CLASS : undefined}>
      <header className="border-b border-gray-200 pb-4 text-center">
        {data.school?.logo_url && <img src={data.school.logo_url} alt="School logo" className="mx-auto mb-2 h-12 w-auto" />}
        <h1 className="text-xl font-bold">{data.school?.name ?? 'School'}</h1>
        {data.school?.motto && <p className="text-sm italic text-gray-600">{data.school.motto}</p>}
        <p className="text-xs text-gray-500">{[data.school?.county, data.school?.region, data.school?.country].filter(Boolean).join(', ')}</p>
        <p className="text-xs text-gray-500">{data.school?.contact_phone && `Tel: ${data.school.contact_phone}`} {data.school?.contact_email && `Email: ${data.school.contact_email}`}</p>
        <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Receipt</p>
      </header>
      <section className="mt-6 grid grid-cols-2 gap-3 text-sm">
        {fields.map(([label, value]) => (
          <div key={label}>
            <span className="font-semibold">{label}</span> {value}
          </div>
        ))}
      </section>
    </article>
  );
}
