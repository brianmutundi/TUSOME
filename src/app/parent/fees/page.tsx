'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import {
  createMyChildReceiptToken,
  createMyChildStatementToken,
  describeAnalyticsError,
  getMyChildFees,
  getMyChildPayments,
  getMyChildReceipts,
} from '@/lib/analytics/api';
import { formatKes } from '@/lib/format-kes';
import { feeTotals, openShareDocument } from '@/lib/parent/portal';
import { useChildData } from '@/lib/parent/useChildData';
import { PaybillButton } from '@/components/parent/PaybillSheet';
import { ChildGuard, ChildSwitcher, LoadFailure, ScreenSkeleton, SectionHeading, TopBar, cardClass } from '@/components/parent/parts';
import type { MyChild } from '@/lib/analytics/api';

const PREVIEW_COUNT = 5;
const date = (iso: string) => new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });

function Fees({ child }: { child: MyChild }) {
  const fees = useChildData(child.studentId, getMyChildFees, 'Could not load fees.');
  const receipts = useChildData(child.studentId, getMyChildReceipts, 'Could not load receipts.');
  const payments = useChildData(child.studentId, (id, o) => getMyChildPayments(id, 20, o), 'Could not load payments.');
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (key: string, task: () => Promise<void>, fallback: string) => {
    setBusy(key);
    setActionError(null);
    try {
      await task();
    } catch (e) {
      setActionError(describeAnalyticsError(e, fallback));
    } finally {
      setBusy(null);
    }
  };

  if (fees.error) return <div className="px-5"><LoadFailure message={fees.error} onRetry={fees.retry} /></div>;
  if (!fees.data) return <ScreenSkeleton />;

  const totals = feeTotals(fees.data);
  const owed = totals.owed;
  const list = receipts.data ? (showAll ? receipts.data : receipts.data.slice(0, PREVIEW_COUNT)) : [];

  return (
    <div className="space-y-5 px-5">
      <ChildSwitcher />

      <section className={cardClass} aria-label="Fee balance">
        <div className="p-4">
          <p className="text-sm font-semibold text-gray-500">Balance owed</p>
          <p className={`mt-0.5 text-3xl font-extrabold tracking-tight ${owed > 0 ? 'text-danger-600' : 'text-success-700'}`}>{formatKes(owed)}</p>
          {totals.billed > 0 && (
            <div className="mt-3">
              <div
                role="progressbar"
                aria-label="Fees paid this term"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(totals.percentPaid)}
                className="h-2 overflow-hidden rounded-full bg-gray-100"
              >
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${totals.percentPaid}%` }} />
              </div>
              <p className="mt-1.5 flex justify-between text-xs font-semibold text-gray-500">
                <span>Paid {formatKes(totals.paid)}</span>
                <span>Billed {formatKes(totals.billed - totals.waived)}</span>
              </p>
            </div>
          )}
        </div>
        {fees.data.length === 0 ? (
          <p className="border-t border-gray-100 p-4 text-sm text-gray-500">No fee balances recorded.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border-t border-gray-100">
            {fees.data.map((f) => (
              <li key={f.voteHeadId} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-gray-700">{f.voteHeadName}</span>
                <span className="font-bold text-gray-900">{formatKes(f.balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PaybillButton
        studentId={child.studentId}
        className="flex min-h-[3rem] w-full items-center justify-center rounded-2xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
      />

      {actionError && <p role="alert" className="text-sm font-medium text-danger-600">{actionError}</p>}

      <section>
        <SectionHeading
          title="Receipts"
          action={
            receipts.data && receipts.data.length > PREVIEW_COUNT ? (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="min-h-[2.75rem] px-1 text-sm font-bold text-brand-600">
                {showAll ? 'Show less' : `Show all (${receipts.data.length})`}
              </button>
            ) : undefined
          }
        />
        {receipts.error ? (
          <div className="mt-2"><LoadFailure message={receipts.error} onRetry={receipts.retry} /></div>
        ) : !receipts.data ? (
          <p className={`${cardClass} mt-2 p-4 text-sm text-gray-500`}>Loading receipts…</p>
        ) : list.length === 0 ? (
          <p className={`${cardClass} mt-2 p-4 text-sm text-gray-500`}>No receipts yet. Receipts appear here once the school confirms a payment.</p>
        ) : (
          <ul className="mt-2 space-y-2.5">
            {list.map((r) => (
              <li key={r.receipt_id} className={`${cardClass} flex items-center justify-between gap-3 p-3.5`}>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">{formatKes(r.amount_paid)}</p>
                  <p className="break-words text-xs text-gray-500">
                    {date(r.paid_at)} · {r.payment_method} · {r.receipt_number}
                    {r.paid_by ? ` · Paid by ${r.paid_by}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Open receipt ${r.receipt_number}`}
                  disabled={busy === r.receipt_id}
                  onClick={() => run(r.receipt_id, () => openShareDocument(() => createMyChildReceiptToken(r.receipt_id), (t) => `/receipt/${t}`), 'Could not open receipt.')}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  <Download className="h-5 w-5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {payments.data && payments.data.length > 0 && (
        <section>
          <SectionHeading title="Payment history" />
          <ul className={`${cardClass} mt-2 divide-y divide-gray-100`}>
            {payments.data.map((p) => (
              <li key={p.collectionId} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-gray-700">
                  {date(p.collectedAt)}
                  {p.referenceNumber ? ` · ${p.referenceNumber}` : ''}
                </span>
                <span className="font-bold text-gray-900">{formatKes(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        disabled={busy === 'statement'}
        onClick={() => run('statement', () => openShareDocument(() => createMyChildStatementToken(child.studentId), (t) => `/statement/${t}`), 'Could not open statement.')}
        className="flex min-h-[3rem] w-full items-center justify-center rounded-2xl border-[1.5px] border-brand-100 bg-white px-4 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        {busy === 'statement' ? 'Opening…' : 'View fee statement'}
      </button>
    </div>
  );
}

export default function FeesPage() {
  return (
    <>
      <TopBar eyebrow="Fees and receipts" title="Fees" />
      <ChildGuard>{(child) => <Fees key={child.studentId} child={child} />}</ChildGuard>
    </>
  );
}
