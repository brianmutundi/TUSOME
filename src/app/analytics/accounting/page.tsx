'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getChartOfAccounts,
  getCashBookEntries,
  getTrialBalance,
  isAbortError,
  recordCashBookEntry,
  upsertChartOfAccount,
} from '@/lib/analytics/api';
import type { CashBookEntry, ChartOfAccount, TrialBalanceRow } from '@/lib/analytics/types';

export default function AccountingPage() {
  const [tab, setTab] = useState<'accounts' | 'cashbook' | 'trialbalance'>('accounts');
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [cashBook, setCashBook] = useState<CashBookEntry[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Account form
  const [showAcctForm, setShowAcctForm] = useState(false);
  const [acctCode, setAcctCode] = useState('');
  const [acctName, setAcctName] = useState('');
  const [acctType, setAcctType] = useState('asset');
  const [savingAcct, setSavingAcct] = useState(false);

  // Cash book form
  const [showCbForm, setShowCbForm] = useState(false);
  const [cbType, setCbType] = useState('receipt');
  const [cbAmount, setCbAmount] = useState('');
  const [cbDesc, setCbDesc] = useState('');
  const [cbMethod, setCbMethod] = useState('cash');
  const [savingCb, setSavingCb] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getChartOfAccounts({ signal: controller.signal }),
      getCashBookEntries(50, { signal: controller.signal }),
      getTrialBalance(undefined, { signal: controller.signal }),
    ])
      .then(([a, c, t]) => {
        if (!active) return;
        setAccounts(a);
        setCashBook(c);
        setTrialBalance(t);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load accounting data.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acctCode.trim() || !acctName.trim()) { setActionError('Code and name required.'); return; }
    setSavingAcct(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertChartOfAccount(acctCode.trim(), acctName.trim(), acctType);
      setActionSuccess('Account created.');
      setShowAcctForm(false);
      setAcctCode(''); setAcctName('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create account.'));
    } finally {
      setSavingAcct(false);
    }
  };

  const handleCashBookEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cbAmount || !cbDesc.trim()) { setActionError('Amount and description required.'); return; }
    setSavingCb(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await recordCashBookEntry(cbType, Number(cbAmount), cbDesc.trim(), undefined, undefined, cbMethod);
      setActionSuccess('Cash book entry recorded.');
      setShowCbForm(false);
      setCbAmount(''); setCbDesc('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not record entry.'));
    } finally {
      setSavingCb(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading accounting…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load accounting">{error}</Alert>
      </main>
    );
  }

  const totalDebits = trialBalance.reduce((s, r) => s + r.total_debit, 0);
  const totalCredits = trialBalance.reduce((s, r) => s + r.total_credit, 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Accounting
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Accounting</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Chart of accounts, cash book, journals, and trial balance.</p>
        </div>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {(['accounts', 'cashbook', 'trialbalance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition ${
              tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'trialbalance' ? 'Trial Balance' : t === 'cashbook' ? 'Cash Book' : 'Chart of Accounts'}
          </button>
        ))}
      </div>

      {/* Chart of Accounts Tab */}
      {tab === 'accounts' && (
        <>
          <div className="mb-4 flex justify-end">
            <Button variant="primary" onClick={() => setShowAcctForm((v) => !v)}>
              {showAcctForm ? 'Close' : '+ Add Account'}
            </Button>
          </div>
          {showAcctForm && (
            <Card className="mb-6">
              <CardHeader title="Add Account" />
              <form onSubmit={handleCreateAccount} className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <TextField id="acct-code" label="Code" required placeholder="e.g. 1000" value={acctCode} onChange={(e) => setAcctCode(e.target.value)} />
                  <TextField id="acct-name" label="Name" required placeholder="e.g. Cash" value={acctName} onChange={(e) => setAcctName(e.target.value)} />
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                    <select value={acctType} onChange={(e) => setAcctType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                      <option value="asset">Asset</option>
                      <option value="liability">Liability</option>
                      <option value="equity">Equity</option>
                      <option value="revenue">Revenue</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingAcct}>{savingAcct ? 'Saving…' : 'Save Account'}</Button>
                </div>
              </form>
            </Card>
          )}
          {accounts.length === 0 ? (
            <EmptyState title="No accounts" description="Create your first account above." />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Code</th>
                      <th scope="col" className="px-4 py-3">Name</th>
                      <th scope="col" className="px-4 py-3">Type</th>
                      <th scope="col" className="px-4 py-3">Parent</th>
                      <th scope="col" className="px-4 py-3">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {accounts.map((a) => (
                      <tr key={a.account_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{a.code}</td>
                        <td className="px-4 py-2.5 text-gray-700">{a.name}</td>
                        <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{a.account_type}</Badge></td>
                        <td className="px-4 py-2.5 text-gray-600">{a.parent_name || '—'}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={a.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>
                            {a.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Cash Book Tab */}
      {tab === 'cashbook' && (
        <>
          <div className="mb-4 flex justify-end">
            <Button variant="primary" onClick={() => setShowCbForm((v) => !v)}>
              {showCbForm ? 'Close' : '+ Record Entry'}
            </Button>
          </div>
          {showCbForm && (
            <Card className="mb-6">
              <CardHeader title="Record Cash Book Entry" />
              <form onSubmit={handleCashBookEntry} className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                    <select value={cbType} onChange={(e) => setCbType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                      <option value="receipt">Receipt</option>
                      <option value="payment">Payment</option>
                      <option value="transfer">Transfer</option>
                      <option value="adjustment">Adjustment</option>
                    </select>
                  </div>
                  <TextField id="cb-amount" label="Amount" type="number" required value={cbAmount} onChange={(e) => setCbAmount(e.target.value)} />
                  <TextField id="cb-desc" label="Description" required value={cbDesc} onChange={(e) => setCbDesc(e.target.value)} />
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Method</label>
                    <select value={cbMethod} onChange={(e) => setCbMethod(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                      <option value="cash">Cash</option>
                      <option value="mpesa">M-Pesa</option>
                      <option value="bank">Bank</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingCb}>{savingCb ? 'Saving…' : 'Record Entry'}</Button>
                </div>
              </form>
            </Card>
          )}
          {cashBook.length === 0 ? (
            <EmptyState title="No cash book entries" description="Record your first entry above." />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Date</th>
                      <th scope="col" className="px-4 py-3">Type</th>
                      <th scope="col" className="px-4 py-3">Amount</th>
                      <th scope="col" className="px-4 py-3">Description</th>
                      <th scope="col" className="px-4 py-3">Account</th>
                      <th scope="col" className="px-4 py-3">Method</th>
                      <th scope="col" className="px-4 py-3">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {cashBook.map((c) => (
                      <tr key={c.entry_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-xs text-gray-600">{c.entry_date}</td>
                        <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{c.entry_type}</Badge></td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{c.amount}</td>
                        <td className="px-4 py-2.5 text-gray-700">{c.description}</td>
                        <td className="px-4 py-2.5 text-gray-600">{c.account_code ? `${c.account_code} - ${c.account_name}` : '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600">{c.payment_method || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{c.recorded_by_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Trial Balance Tab */}
      {tab === 'trialbalance' && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">Total Debits: <strong>{totalDebits}</strong> | Total Credits: <strong>{totalCredits}</strong></p>
            {totalDebits === totalCredits && totalDebits > 0 && (
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Balanced ✓</Badge>
            )}
          </div>
          {trialBalance.length === 0 ? (
            <EmptyState title="No accounts" description="Create accounts and post journal entries to see trial balance." />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Code</th>
                      <th scope="col" className="px-4 py-3">Account</th>
                      <th scope="col" className="px-4 py-3">Type</th>
                      <th scope="col" className="px-4 py-3">Debit</th>
                      <th scope="col" className="px-4 py-3">Credit</th>
                      <th scope="col" className="px-4 py-3">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {trialBalance.map((t) => (
                      <tr key={t.account_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{t.account_code}</td>
                        <td className="px-4 py-2.5 text-gray-700">{t.account_name}</td>
                        <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{t.account_type}</Badge></td>
                        <td className="px-4 py-2.5 text-gray-700">{t.total_debit}</td>
                        <td className="px-4 py-2.5 text-gray-700">{t.total_credit}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{t.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
