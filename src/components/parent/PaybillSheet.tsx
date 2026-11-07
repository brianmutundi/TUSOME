'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { getMyChildPaybill } from '@/lib/analytics/api';
import { useChildData } from '@/lib/parent/useChildData';
import { LoadFailure } from './parts';

/** Phase A only: shows how to pay by paybill. Nothing here starts a payment. */
function Details({ studentId }: { studentId: string }) {
  const { data, error, retry } = useChildData(studentId, getMyChildPaybill, 'Could not load payment details.');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  if (error) return <LoadFailure message={error} onRetry={retry} />;
  if (!data) return <p className="text-sm text-gray-500">Loading payment details…</p>;
  if (!data.paybillNumber) {
    return (
      <p className="text-sm text-gray-700">
        {data.schoolName || 'The school'} has not set up M-Pesa paybill details yet. Please contact the school office to pay.
      </p>
    );
  }

  const copy = async () => {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(data.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-gray-100 rounded-xl border border-gray-100">
        <div className="flex justify-between gap-3 px-4 py-3 text-sm">
          <dt className="text-gray-500">Paybill number</dt>
          <dd className="font-mono text-base font-bold text-gray-900">{data.paybillNumber}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <dt className="text-gray-500">Account number</dt>
          <dd className="font-mono text-base font-bold text-gray-900">{data.accountNumber}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={copy}
        className="flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-brand-100 bg-white px-4 text-sm font-bold text-brand-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        {copied && <Check className="h-4 w-4" aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy account number'}
      </button>
      {copyFailed && (
        <p role="alert" className="text-sm font-medium text-danger-600">
          Could not copy. Type the account number {data.accountNumber} by hand.
        </p>
      )}
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
        <li>Open M-Pesa and choose Lipa na M-Pesa, then Pay Bill.</li>
        <li>Enter business number {data.paybillNumber}.</li>
        <li>Enter account number {data.accountNumber}.</li>
        <li>Enter the amount and your M-Pesa PIN.</li>
      </ol>
      <p className="text-xs text-gray-500">
        Use the admission number exactly as shown so the school can match your payment. Your receipt appears in the app once the school confirms it.
      </p>
    </div>
  );
}

/** Opens a bottom sheet with the paybill instructions for one child. */
export function PaybillButton({ studentId, className }: { studentId: string; className: string }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        Pay with M-Pesa
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="paybill-title"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="paybill-title" className="text-lg font-extrabold text-gray-900">Pay with M-Pesa</h2>
              <button
                ref={closeRef}
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-xl bg-gray-100 text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <Details studentId={studentId} />
          </div>
        </div>
      )}
    </>
  );
}
