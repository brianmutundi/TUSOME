'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  createWalletTransaction,
  describeAnalyticsError,
  getStudentDirectory,
  getWallet,
  getWalletTransactions,
  isAbortError,
} from '@/lib/analytics/api';
import type { StudentDirectoryRow, Wallet, WalletTransaction } from '@/lib/analytics/types';

export default function WalletPage() {
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [ownerId, setOwnerId] = useState('');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [txnType, setTxnType] = useState('deposit');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnDesc, setTxnDesc] = useState('');
  const [txnRef, setTxnRef] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getStudentDirectory(undefined, undefined, undefined, undefined, { signal: controller.signal })
      .then((data) => { if (!active) return; setStudents(data); if (data.length > 0) setOwnerId(data[0].student_id); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load students.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    if (!ownerId) { setWallet(null); setTransactions([]); return; }
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getWallet(ownerId, { signal: controller.signal }),
      getWalletTransactions(ownerId, 50, { signal: controller.signal }),
    ])
      .then(([w, t]) => { if (!active) return; setWallet(w); setTransactions(t); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load wallet.')); });
    return () => { active = false; controller.abort(); };
  }, [ownerId]);

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId || !txnAmount) return;
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createWalletTransaction(ownerId, txnType, Number(txnAmount), txnDesc.trim() || undefined, txnRef.trim() || undefined);
      setActionSuccess('Transaction recorded.');
      setShowForm(false);
      setTxnAmount(''); setTxnDesc(''); setTxnRef('');
      const [w, t] = await Promise.all([getWallet(ownerId), getWalletTransactions(ownerId, 50)]);
      setWallet(w);
      setTransactions(t);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not record transaction.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading wallet…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load wallet">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Wallet
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Wallet & Payments</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage digital wallets and transactions.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ New Transaction'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="wallet-student" label="Student" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {students.map((s) => (<option key={s.student_id} value={s.student_id}>{s.full_name || s.admission_no}</option>))}
          </SelectField>
        </div>
      </Card>

      {wallet && (
        <Card className="mb-6">
          <div className="p-5 text-center">
            <p className="text-xs text-gray-500">Current Balance</p>
            <p className="text-3xl font-bold text-gray-900">{wallet.balance} {wallet.currency}</p>
          </div>
        </Card>
      )}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="New Transaction" />
          <form onSubmit={handleTransaction} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                <select value={txnType} onChange={(e) => setTxnType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="payment">Payment</option>
                  <option value="refund">Refund</option>
                </select>
              </div>
              <TextField id="txn-amount" label="Amount" type="number" required value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} />
              <TextField id="txn-desc" label="Description" value={txnDesc} onChange={(e) => setTxnDesc(e.target.value)} />
              <TextField id="txn-ref" label="Reference" value={txnRef} onChange={(e) => setTxnRef(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record Transaction'}</Button>
            </div>
          </form>
        </Card>
      )}

      {transactions.length === 0 ? (
        <EmptyState title="No transactions" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Amount</th>
                  <th scope="col" className="px-4 py-3">Balance After</th>
                  <th scope="col" className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {transactions.map((t) => (
                  <tr key={t.transaction_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs text-gray-600">{new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{t.transaction_type}</Badge></td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{t.amount}</td>
                    <td className="px-4 py-2.5 text-gray-700">{t.balance_after}</td>
                    <td className="px-4 py-2.5 text-gray-700">{t.description || '—'}</td>
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
