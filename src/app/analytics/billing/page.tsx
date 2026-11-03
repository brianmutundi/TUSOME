'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  createInvoice,
  describeAnalyticsError,
  getInvoices,
  getReceipts,
  isAbortError,
  recordReceipt,
} from '@/lib/analytics/api';
import type { Invoice, Receipt } from '@/lib/analytics/types';

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [invNumber, setInvNumber] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invTax, setInvTax] = useState('0');
  const [invDueDate, setInvDueDate] = useState('');
  const [invNotes, setInvNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState('');

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    getInvoices(undefined, { signal: controller.signal })
      .then((data) => { if (!active) return; setInvoices(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load invoices.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  useEffect(() => {
    if (!selectedInvoice) { setReceipts([]); return; }
    const controller = new AbortController();
    let active = true;
    getReceipts(selectedInvoice, { signal: controller.signal })
      .then((data) => { if (!active) return; setReceipts(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load receipts.')); });
    return () => { active = false; controller.abort(); };
  }, [selectedInvoice]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invNumber.trim()) { setActionError('Invoice number is required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createInvoice(invNumber.trim(), undefined, Number(invAmount) || 0, Number(invTax) || 0, invDueDate || undefined, invNotes.trim() || undefined);
      setActionSuccess('Invoice created.');
      setShowForm(false);
      setInvNumber(''); setInvAmount(''); setInvTax('0'); setInvDueDate(''); setInvNotes('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create invoice.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading billing…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load billing">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Billing
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Billing & Invoices</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage invoices and receipts.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Create Invoice'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Create Invoice" />
          <form onSubmit={handleCreate} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField id="inv-number" label="Invoice Number" required value={invNumber} onChange={(e) => setInvNumber(e.target.value)} />
              <TextField id="inv-amount" label="Amount" type="number" value={invAmount} onChange={(e) => setInvAmount(e.target.value)} />
              <TextField id="inv-tax" label="Tax" type="number" value={invTax} onChange={(e) => setInvTax(e.target.value)} />
              <TextField id="inv-due" label="Due Date" type="date" value={invDueDate} onChange={(e) => setInvDueDate(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Invoice'}</Button>
            </div>
          </form>
        </Card>
      )}

      {invoices.length === 0 ? (
        <EmptyState title="No invoices" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Invoice #</th>
                  <th scope="col" className="px-4 py-3">Student</th>
                  <th scope="col" className="px-4 py-3">Total</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Due Date</th>
                  <th scope="col" className="px-4 py-3">Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {invoices.map((inv) => (
                  <tr key={inv.invoice_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{inv.invoice_number}</td>
                    <td className="px-4 py-2.5 text-gray-700">{inv.student_name || '—'}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{inv.total_amount}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={inv.status === 'paid' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : inv.status === 'overdue' ? 'border-red-200 bg-red-50 text-red-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>{inv.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{inv.due_date || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{inv.issued_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </main>
  );
}
