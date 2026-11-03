'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import { exportToExcel } from '@/lib/analytics/excel';
import {
  describeAnalyticsError,
  getFeePayments,
  getFeePledges,
  getFeeBalances,
  getFeeCollections,
  getMyPermissions,
  getFinanceSummary,
  getInvoices,
  getReceipts,
  getFeeStructures,
  getReversalReasons,
  getStudentVoteHeadBalances,
  getVoteHeadCategories,
  getVoteHeads,
  recordFeeCollection,
  upsertVoteHead,
  getStudentDirectory,
  getStudentFeeBalance,
  isAbortError,
  recordFeePayment,
  upsertFeeStructure,
} from '@/lib/analytics/api';
import type { FeeBalance, FeeCollection, FeePayment, FeePledge, FeeStructure, Invoice, Receipt, ReversalReason, StudentDirectoryRow, StudentVoteHeadBalance, VoteHead, VoteHeadCategory } from '@/lib/analytics/types';

export default function FinancePage() {
  const [tab, setTab] = useState<'summary' | 'balances' | 'structures' | 'payments' | 'pledges' | 'voteheads' | 'collections' | 'invoices' | 'receipts'>('summary');
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [pledges, setPledges] = useState<FeePledge[]>([]);
  const [voteHeads, setVoteHeads] = useState<VoteHead[]>([]);
  const [collections, setCollections] = useState<FeeCollection[]>([]);
  const [financeSummary, setFinanceSummary] = useState<Record<string, unknown> | null>(null);

  // Balances table state
  const [balanceData, setBalanceData] = useState<any>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceSearch, setBalanceSearch] = useState('');
  const [balanceClass, setBalanceClass] = useState('');
  const [balanceTerm, setBalanceTerm] = useState('');
  const [balanceYear, setBalanceYear] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('all');
  const [balanceMin, setBalanceMin] = useState('');
  const [balanceMax, setBalanceMax] = useState('');
  const [balanceSortBy, setBalanceSortBy] = useState('admission_no');
  const [balanceSortDir, setBalanceSortDir] = useState('asc');
  const [balancePage, setBalancePage] = useState(1);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [canManageFees, setCanManageFees] = useState(false);
  const [collectionClass, setCollectionClass] = useState('');
  const [collectionSort, setCollectionSort] = useState('collected_at');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [reversalReasons, setReversalReasons] = useState<ReversalReason[]>([]);
  const [voteHeadBalances, setVoteHeadBalances] = useState<StudentVoteHeadBalance[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [balance, setBalance] = useState<FeeBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Structure form
  const [showStructForm, setShowStructForm] = useState(false);
  const [structName, setStructName] = useState('');
  const [structAmount, setStructAmount] = useState('');
  const [structTerm, setStructTerm] = useState('Term 1');
  const [structYear, setStructYear] = useState(String(new Date().getFullYear()));
  const [savingStruct, setSavingStruct] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getStudentDirectory(undefined, undefined, undefined, undefined, { signal: controller.signal }),
      getFeeStructures(undefined, undefined, { signal: controller.signal }),
      getVoteHeads({ signal: controller.signal }),
      getFeeCollections(undefined, collectionClass || undefined, undefined, undefined, undefined, undefined, collectionSort, 'desc', 50, { signal: controller.signal }),
      getFinanceSummary(undefined, undefined, undefined, undefined, undefined, { signal: controller.signal }),
      getInvoices(undefined, { signal: controller.signal }),
      getReceipts(undefined, { signal: controller.signal }),
      getMyPermissions({ signal: controller.signal }),
    ])
      .then(([s, st, vh, col, summary, inv, rec, me]) => {
        if (!active) return;
        setStudents(s);
        setStructures(st);
        setVoteHeads(vh);
        setCollections(col);
        setFinanceSummary(summary);
        setInvoices(inv);
        setReceipts(rec);
        setCanManageFees((me?.permissions ?? []).some((p) => p === 'manage-fees' || p === 'view-fees'));
        if (s.length > 0) setSelectedStudent(s[0].student_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load finance data.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    setBalancePage(1);
  }, [balanceSearch, balanceClass, balanceTerm, balanceYear, balanceFilter, balanceMin, balanceMax, balanceSortBy, balanceSortDir]);

  useEffect(() => {
    if (tab !== 'balances') return;
    const controller = new AbortController();
    let active = true;
    setBalanceLoading(true);
    setBalanceError(null);
    getFeeBalances(
      balanceSearch || undefined,
      balanceClass || undefined,
      balanceTerm || undefined,
      balanceYear ? Number(balanceYear) : undefined,
      balanceFilter,
      balanceMin ? Number(balanceMin) : undefined,
      balanceMax ? Number(balanceMax) : undefined,
      balanceSortBy,
      balanceSortDir,
      balancePage,
      25,
      { signal: controller.signal }
    )
      .then((data) => { if (active) { setBalanceData(data); setBalanceLoading(false); } })
      .catch((caught) => { if (active) { setBalanceError(caught instanceof Error ? caught.message : 'Could not load balances.'); setBalanceLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [tab, balanceSearch, balanceClass, balanceTerm, balanceYear, balanceFilter, balanceMin, balanceMax, balanceSortBy, balanceSortDir, balancePage]);

  useEffect(() => {
    const controller = new AbortController();
    getFeeCollections(undefined, collectionClass || undefined, undefined, undefined, undefined, undefined, collectionSort, 'desc', 50, { signal: controller.signal })
      .then((data) => setCollections(data))
      .catch(() => {});
    return () => controller.abort();
  }, [collectionClass, collectionSort]);

  useEffect(() => {
    if (!selectedStudent) { setBalance(null); setPayments([]); setPledges([]); return; }
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getStudentFeeBalance(selectedStudent, undefined, undefined, { signal: controller.signal }),
      getFeePayments(selectedStudent, 50, { signal: controller.signal }),
      getFeePledges(selectedStudent, { signal: controller.signal }),
    ])
      .then(([b, p, pl]) => {
        if (!active) return;
        setBalance(b);
        setPayments(p);
        setPledges(pl);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load student finance.')); });
    return () => { active = false; controller.abort(); };
  }, [selectedStudent]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !payAmount) return;
    const allocEntries = Object.entries(allocations)
      .filter(([, v]) => v && Number(v) > 0)
      .map(([k, v]) => ({ vote_head_id: k, amount: Number(v) }));
    const allocTotal = allocEntries.reduce((s, a) => s + a.amount, 0);
    if (allocEntries.length > 0 && Math.abs(allocTotal - Number(payAmount)) > 0.001) {
      setActionError('Allocations must sum to the payment amount.');
      return;
    }
    // Overpayment confirmation
    const bal = balanceData?.rows?.find((r: any) => r.student_id === selectedStudent);
    const outstanding = bal ? Number(bal.balance ?? 0) : 0;
    if (Number(payAmount) > outstanding && outstanding > 0) {
      if (!window.confirm(`Amount exceeds outstanding balance (KES ${outstanding.toLocaleString()}). This will create a credit. Continue?`)) {
        return;
      }
    }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await recordFeePayment(selectedStudent, Number(payAmount), payMethod, payRef || undefined, undefined, undefined, payNotes || undefined, paymentIdempotencyKey ?? undefined, undefined, allocEntries.length > 0 ? allocEntries : undefined);
      setActionSuccess('Payment recorded.');
      setPayAmount(''); setPayRef(''); setPayNotes('');
      setShowPaymentModal(false);
      setPaymentIdempotencyKey(null);
      // Refresh balances
      setBalancePage(1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not record payment.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!structName.trim() || !structAmount) return;
    setSavingStruct(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertFeeStructure(null, Number(structYear), structTerm, structName.trim(), Number(structAmount));
      setActionSuccess('Fee structure created.');
      setShowStructForm(false);
      setStructName(''); setStructAmount('');
      const st = await getFeeStructures(Number(structYear), structTerm);
      setStructures(st);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create fee structure.'));
    } finally {
      setSavingStruct(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading finance…" />;

  if (!canManageFees && !loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Access denied">You do not have permission to view finance data.</Alert>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load finance">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Finance
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Finance & Fees</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage fee structures, record payments, track balances, and pledges.</p>
        </div>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {(['summary', 'balances', 'structures', 'payments', 'pledges', 'voteheads', 'collections', 'invoices', 'receipts'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition ${
              tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {tab === 'summary' && financeSummary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader title="Collected" />
            <div className="p-4 text-2xl font-bold text-gray-900">{Number(financeSummary.collected ?? 0).toLocaleString()}</div>
          </Card>
          <Card>
            <CardHeader title="Invoice Total" />
            <div className="p-4 text-2xl font-bold text-gray-900">{Number(financeSummary.invoice_total ?? 0).toLocaleString()}</div>
          </Card>
          <Card>
            <CardHeader title="Outstanding" />
            <div className="p-4 text-2xl font-bold text-red-700">{Number(financeSummary.outstanding ?? 0).toLocaleString()}</div>
          </Card>
          <Card>
            <CardHeader title="Collections" />
            <div className="p-4 text-2xl font-bold text-gray-900">{Number(financeSummary.collection_count ?? 0)}</div>
          </Card>
        </div>
      )}

      {/* Balances Tab */}
      {tab === 'balances' && (
        <>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-3">
            <TextField id="bal-search" label="Search" placeholder="Name or adm no." value={balanceSearch} onChange={(e) => setBalanceSearch(e.target.value)} />
            <SelectField id="bal-class" label="Class" value={balanceClass} onChange={(e) => setBalanceClass(e.target.value)}>
              <option value="">All classes</option>
              {Array.from(new Map(students.filter((s) => s.class_id).map((s) => [s.class_id as string, s.class_name])).entries()).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </SelectField>
            <SelectField id="bal-term" label="Term" value={balanceTerm} onChange={(e) => setBalanceTerm(e.target.value)}>
              <option value="">All terms</option>
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </SelectField>
            <SelectField id="bal-year" label="Year" value={balanceYear} onChange={(e) => setBalanceYear(e.target.value)}>
              <option value="">All years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </SelectField>
            <SelectField id="bal-filter" label="Balance" value={balanceFilter} onChange={(e) => setBalanceFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="paid">Fully Paid</option>
              <option value="outstanding">Has Outstanding</option>
              <option value="above5000">Above 5,000</option>
              <option value="above10000">Above 10,000</option>
              <option value="custom">Custom Range</option>
            </SelectField>
            {balanceFilter === 'custom' && (
              <>
                <TextField id="bal-min" label="Min Balance" type="number" value={balanceMin} onChange={(e) => setBalanceMin(e.target.value)} />
                <TextField id="bal-max" label="Max Balance" type="number" value={balanceMax} onChange={(e) => setBalanceMax(e.target.value)} />
              </>
            )}
          </div>

          {/* Summary cards */}
          {balanceData && (
            <div className="mb-6 grid gap-4 sm:grid-cols-4">
              <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Total Fees</p><p className="text-2xl font-bold text-gray-900">{Number(balanceData.summary?.total_fees ?? 0).toLocaleString()}</p></div></Card>
              <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Total Paid</p><p className="text-2xl font-bold text-emerald-700">{Number(balanceData.summary?.total_paid ?? 0).toLocaleString()}</p></div></Card>
              <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Outstanding</p><p className="text-2xl font-bold text-red-700">{Number(balanceData.summary?.outstanding ?? 0).toLocaleString()}</p></div></Card>
              <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Learners</p><p className="text-2xl font-bold text-gray-900">{balanceData.total ?? 0}</p></div></Card>
            </div>
          )}

          {/* Table */}
          {balanceLoading && <LoadingPanel label="Loading balances…" />}

          {balanceError && (
            <Alert tone="error" title="Could not load balances">
              {balanceError}
              <div className="mt-2">
                <Button variant="secondary" size="sm" onClick={() => setBalancePage(1)}>Retry</Button>
              </div>
            </Alert>
          )}

          {!balanceLoading && !balanceError && (balanceData?.rows ?? []).length === 0 && (
            <EmptyState title="No learners match" description="Try adjusting your filters." action={<Button variant="secondary" onClick={() => { setBalanceSearch(''); setBalanceClass(''); setBalanceTerm(''); setBalanceYear(''); setBalanceFilter('all'); setBalanceMin(''); setBalanceMax(''); }}>Reset filters</Button>} />
          )}

          {!balanceLoading && !balanceError && (balanceData?.rows ?? []).length > 0 && (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 cursor-pointer" onClick={() => { setBalanceSortBy('admission_no'); setBalanceSortDir(balanceSortDir === 'asc' ? 'desc' : 'asc'); }}>Adm No.</th>
                    <th scope="col" className="px-4 py-3 cursor-pointer" onClick={() => { setBalanceSortBy('student_name'); setBalanceSortDir(balanceSortDir === 'asc' ? 'desc' : 'asc'); }}>Student Name</th>
                    <th scope="col" className="px-4 py-3 cursor-pointer" onClick={() => { setBalanceSortBy('class_name'); setBalanceSortDir(balanceSortDir === 'asc' ? 'desc' : 'asc'); }}>Class/Grade</th>
                    <th scope="col" className="px-4 py-3 text-right cursor-pointer" onClick={() => { setBalanceSortBy('total_fees'); setBalanceSortDir(balanceSortDir === 'asc' ? 'desc' : 'asc'); }}>Total Fees</th>
                    <th scope="col" className="px-4 py-3 text-right cursor-pointer" onClick={() => { setBalanceSortBy('total_paid'); setBalanceSortDir(balanceSortDir === 'asc' ? 'desc' : 'asc'); }}>Fees Paid</th>
                    <th scope="col" className="px-4 py-3 text-right cursor-pointer" onClick={() => { setBalanceSortBy('balance'); setBalanceSortDir(balanceSortDir === 'asc' ? 'desc' : 'asc'); }}>Balance</th>
                    <th scope="col" className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {(balanceData?.rows ?? []).map((row: any) => (
                    <tr key={row.student_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{row.admission_no}</td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          className="font-medium text-blue-700 hover:underline"
                          onClick={() => setSelectedStudent(row.student_id)}
                        >
                          {row.student_name || '—'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{row.class_name || '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{Number(row.total_fees).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{Number(row.total_paid).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-red-700">{Number(row.balance).toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        {canManageFees && selectedStudent === row.student_id && (
                          <Button size="sm" onClick={() => { setPaymentIdempotencyKey(crypto.randomUUID()); setShowPaymentModal(true); }}>Record Payment</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm">
              <span className="text-gray-600">
                Page {balanceData?.page ?? 1} of {Math.ceil((balanceData?.total ?? 0) / (balanceData?.page_size ?? 25))}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={(balanceData?.page ?? 1) <= 1} onClick={() => setBalancePage((p) => Math.max(1, p - 1))}>Prev</Button>
                <Button variant="secondary" size="sm" disabled={(balanceData?.page ?? 1) >= Math.ceil((balanceData?.total ?? 0) / (balanceData?.page_size ?? 25))} onClick={() => setBalancePage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </Card>
          )}

          {/* Record Payment Modal */}
          {showPaymentModal && selectedStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Record Payment</h2>
                <form onSubmit={handleRecordPayment} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField id="pay-amount" label="Amount" type="number" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Method</label>
                      <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                        <option value="cash">Cash</option>
                        <option value="mpesa">M-Pesa</option>
                        <option value="bank">Bank</option>
                        <option value="cheque">Cheque</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <TextField id="pay-ref" label="Reference No." value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                    <TextField id="pay-notes" label="Notes" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
                  </div>
                  {voteHeads.length > 0 && (
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Allocations (must sum to amount)</label>
                      <div className="space-y-2">
                        {voteHeads.map((vh) => (
                          <div key={vh.vote_head_id} className="flex items-center gap-2">
                            <span className="flex-1 text-sm text-gray-700">{vh.name}</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={allocations[vh.vote_head_id] ?? ''}
                              onChange={(e) => setAllocations((prev) => ({ ...prev, [vh.vote_head_id]: e.target.value }))}
                              className="w-28 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-right"
                              placeholder="0"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
                    <Button type="submit" disabled={saving}>{saving ? 'Recording…' : 'Record Payment'}</Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* Structures Tab */}
      {tab === 'structures' && (
        <>
          <div className="mb-4 flex justify-end">
            <Button variant="primary" onClick={() => setShowStructForm((v) => !v)}>
              {showStructForm ? 'Close' : '+ Add Fee Structure'}
            </Button>
          </div>
          {showStructForm && (
            <Card className="mb-6">
              <CardHeader title="Add Fee Structure" />
              <form onSubmit={handleCreateStructure} className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <TextField id="fs-name" label="Name" required placeholder="e.g. Tuition Fee" value={structName} onChange={(e) => setStructName(e.target.value)} />
                  <TextField id="fs-amount" label="Amount" type="number" required value={structAmount} onChange={(e) => setStructAmount(e.target.value)} />
                  <TextField id="fs-term" label="Term" value={structTerm} onChange={(e) => setStructTerm(e.target.value)} />
                  <TextField id="fs-year" label="Academic Year" type="number" value={structYear} onChange={(e) => setStructYear(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingStruct}>{savingStruct ? 'Saving…' : 'Save Structure'}</Button>
                </div>
              </form>
            </Card>
          )}
          {structures.length === 0 ? (
            <EmptyState title="No fee structures" />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Name</th>
                      <th scope="col" className="px-4 py-3">Class</th>
                      <th scope="col" className="px-4 py-3">Term</th>
                      <th scope="col" className="px-4 py-3">Year</th>
                      <th scope="col" className="px-4 py-3">Amount</th>
                      <th scope="col" className="px-4 py-3">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {structures.map((s) => (
                      <tr key={s.structure_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{s.name}</td>
                        <td className="px-4 py-2.5 text-gray-600">{s.class_name || 'All'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{s.term}</td>
                        <td className="px-4 py-2.5 text-gray-700">{s.academic_year}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{s.amount}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={s.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>
                            {s.is_active ? 'Active' : 'Inactive'}
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

      {/* Pledges Tab */}
      {tab === 'pledges' && (
        <>
          {pledges.length === 0 ? (
            <EmptyState title="No pledges" />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Pledged</th>
                      <th scope="col" className="px-4 py-3">Paid</th>
                      <th scope="col" className="px-4 py-3">Remaining</th>
                      <th scope="col" className="px-4 py-3">Due Date</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {pledges.map((p) => (
                      <tr key={p.pledge_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{p.pledged_amount}</td>
                        <td className="px-4 py-2.5 text-emerald-700">{p.paid_amount}</td>
                        <td className="px-4 py-2.5 text-red-700">{p.remaining_amount}</td>
                        <td className="px-4 py-2.5 text-gray-600">{p.due_date || '—'}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={p.status === 'fulfilled' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}>
                            {p.status}
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

      {/* Vote Heads Tab */}
      {tab === 'voteheads' && (
        <Card>
          <CardHeader title="Vote Heads" />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Category</th>
                  <th scope="col" className="px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {voteHeads.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No vote heads defined.</td></tr>
                ) : (
                  voteHeads.map((vh) => (
                    <tr key={vh.vote_head_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{vh.name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{vh.code || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{vh.category_name || '—'}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={vh.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>
                          {vh.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Collections Tab */}
      {tab === 'collections' && (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => {
              const header = ['Date','Student','Class','Vote Head','Type','Amount','Method'];
              const rows = collections.map((c) => [new Date(c.collected_at).toLocaleDateString(), c.student_name ?? '', c.class_name ?? '', c.vote_head_name ?? '', c.collection_type, c.amount, c.payment_method ?? '']);
              const csv = '\\uFEFF' + [header, ...rows].map((r) => r.map((v) => `\"${String(v).replace(/\"/g, '\"\"')}\"`).join(',')).join('\\r\\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'collections.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}>Export CSV</Button>
            <Button variant="secondary" onClick={() => {
              exportToExcel(
                'collections.xlsx',
                'Collections',
                [
                  { header: 'Date', key: 'date', width: 14 },
                  { header: 'Student', key: 'student', width: 24 },
                  { header: 'Class', key: 'class', width: 12 },
                  { header: 'Vote Head', key: 'votehead', width: 14 },
                  { header: 'Type', key: 'type', width: 12 },
                  { header: 'Amount', key: 'amount', width: 12 },
                  { header: 'Method', key: 'method', width: 12 },
                ],
                collections,
                (c, key) => {
                  switch (key) {
                    case 'date': return new Date(c.collected_at).toLocaleDateString();
                    case 'student': return c.student_name ?? '';
                    case 'class': return c.class_name ?? '';
                    case 'votehead': return c.vote_head_name ?? '';
                    case 'type': return c.collection_type;
                    case 'amount': return c.amount;
                    case 'method': return c.payment_method ?? '';
                    default: return '';
                  }
                },
                { title: 'Fee Collections' }
              );
            }}>Export Excel</Button>
            <SelectField id="coll-class" label="Class" value={collectionClass} onChange={(e) => setCollectionClass(e.target.value)}>
              <option value="">All classes</option>
              {Array.from(new Set(students.map((s) => s.class_name).filter(Boolean))).map((c) => (
                <option key={c as string} value={c as string}>{c as string}</option>
              ))}
            </SelectField>
            <SelectField id="coll-sort" label="Sort by" value={collectionSort} onChange={(e) => setCollectionSort(e.target.value)}>
              <option value="collected_at">Date</option>
              <option value="amount">Amount</option>
              <option value="student_name">Student</option>
            </SelectField>
          </div>

          {collections.length === 0 ? (
            <EmptyState title="No collections" />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Date</th>
                      <th scope="col" className="px-4 py-3">Student</th>
                      <th scope="col" className="px-4 py-3">Class</th>
                      <th scope="col" className="px-4 py-3">Vote Head</th>
                      <th scope="col" className="px-4 py-3">Type</th>
                      <th scope="col" className="px-4 py-3">Amount</th>
                      <th scope="col" className="px-4 py-3">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {collections.map((c) => (
                      <tr key={c.collection_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-xs text-gray-600">{new Date(c.collected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{c.student_name || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{c.class_name || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{c.vote_head_name || '—'}</td>
                        <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{c.collection_type}</Badge></td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{c.amount}</td>
                        <td className="px-4 py-2.5 text-gray-600">{c.payment_method || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Invoices Tab */}
      {tab === 'invoices' && (
        <>
          {invoices.length === 0 ? (
            <EmptyState title="No invoices" description="Create your first invoice above." />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Invoice #</th>
                      <th scope="col" className="px-4 py-3">Student</th>
                      <th scope="col" className="px-4 py-3">Amount</th>
                      <th scope="col" className="px-4 py-3">Total</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3">Issued</th>
                      <th scope="col" className="px-4 py-3">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {invoices.map((inv) => (
                      <tr key={inv.invoice_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{inv.invoice_number}</td>
                        <td className="px-4 py-2.5 text-gray-700">{inv.student_name || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{inv.amount}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{inv.total_amount}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={inv.status === 'paid' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{inv.issued_date}</td>
                        <td className="px-4 py-2.5 text-gray-600">{inv.due_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Receipts Tab */}
      {tab === 'receipts' && (
        <>
          {receipts.length === 0 ? (
            <EmptyState title="No receipts" description="Receipts will appear here." />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Receipt #</th>
                      <th scope="col" className="px-4 py-3">Invoice</th>
                      <th scope="col" className="px-4 py-3">Amount</th>
                      <th scope="col" className="px-4 py-3">Method</th>
                      <th scope="col" className="px-4 py-3">Reference</th>
                      <th scope="col" className="px-4 py-3">Paid At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {receipts.map((r) => (
                      <tr key={r.receipt_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          <Link href={`/analytics/receipts/${r.receipt_id}`} className="text-blue-700 hover:underline">
                            {r.receipt_number}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{r.invoice_number || '—'}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{r.amount_paid}</td>
                        <td className="px-4 py-2.5 text-gray-600">{r.payment_method}</td>
                        <td className="px-4 py-2.5 text-gray-600">{r.reference_number || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600">{new Date(r.paid_at).toLocaleDateString()}</td>
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
