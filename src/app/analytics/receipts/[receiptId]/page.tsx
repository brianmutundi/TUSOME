'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, Badge, Button, Card, LoadingPanel } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { SchoolHeader } from '@/components/documents/SchoolHeader';
import {
  describeAnalyticsError,
  getReceipts,
  isAbortError,
  logAuditEvent,
} from '@/lib/analytics/api';
import type { Receipt } from '@/lib/analytics/types';

function decodeParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return '';
  try { return decodeURIComponent(value); } catch { return value; }
}

export default function ReceiptPage() {
  const params = useParams<{ receiptId?: string | string[] }>();
  const receiptId = decodeParam(params?.receiptId);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!receiptId) { setLoading(false); return; }
    const controller = new AbortController();
    let active = true;
    getReceipts(undefined, { signal: controller.signal })
      .then((data) => {
        if (!active) return;
        const found = data.find((r) => r.receipt_id === receiptId);
        if (found) setReceipt(found);
        else setError('Receipt not found.');
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load receipt.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [receiptId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!receiptId) return;
    setDownloading(true);
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session expired. Sign in again.');
      const res = await fetch(`/api/receipts/${receiptId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receipt?.receipt_number || receiptId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(describeAnalyticsError(caught, 'Could not download PDF.'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading receipt…" />;

  if (error || !receipt) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load receipt">{error || 'Receipt not found.'}</Alert>
      </main>
    );
  }

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 16mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .receipt-card { box-shadow: none; border: 1px solid #e5e7eb; }
          @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #6b7280; }
        }
      `}</style>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="no-print mb-4 flex gap-2">
          <Button variant="primary" onClick={handlePrint}>Print Receipt</Button>
          <Button variant="secondary" onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? 'Generating…' : 'Download PDF'}
          </Button>
          <Link href="/analytics/billing" className="text-blue-700 hover:underline text-sm self-center">Back to Billing</Link>
        </div>

        <Card className="receipt-card">
          <div className="p-8">
            <SchoolHeader title="Official Payment Receipt" />

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <p className="text-xs text-gray-500">Receipt Number</p>
                <p className="font-bold text-gray-900">{receipt.receipt_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Date</p>
                <p className="font-medium text-gray-900">{new Date(receipt.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Invoice Number</p>
                <p className="font-medium text-gray-900">{receipt.invoice_number || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Method</p>
                <p className="font-medium text-gray-900">{receipt.payment_method}</p>
              </div>
            </div>

            <div className="border-t border-b border-gray-200 py-4 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount Paid</span>
                <span className="font-bold text-gray-900 text-lg">KES {receipt.amount_paid.toLocaleString()}</span>
              </div>
              {receipt.reference_number && (
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-600">Transaction Reference</span>
                  <span className="font-medium text-gray-900">{receipt.reference_number}</span>
                </div>
              )}
            </div>

            <div className="text-sm">
              <p className="text-xs text-gray-500">Recorded By</p>
              <p className="font-medium text-gray-900">{receipt.recorded_by_name || '—'}</p>
            </div>

            <div className="mt-6 text-center text-xs text-gray-400">
              <p>This is a computer-generated receipt. No signature required.</p>
              <p>Reprint — Original receipt identity preserved.</p>
            </div>
          </div>
        </Card>
      </main>
    </>
  );
}
