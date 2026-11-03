'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import { exportToExcel } from '@/lib/analytics/excel';
import {
  describeAnalyticsError,
  getFeePayments,
  getFeePledges,
  createFeePledge,
  getFeeBalances,
  getFinanceOverview,
  getMyPermissions,
  getFinanceSummary,
  getReceipts,
  getFeeStructures,
  getReversalReasons,
  getStudentVoteHeadBalances,
  getVoteHeadCategories,
  getVoteHeads,
  upsertVoteHead,
  getStudentDirectory,
  getStudentFeeBalance,
  isAbortError,
  recordFeePayment,
  upsertFeeStructure,
} from '@/lib/analytics/api';
import type { FeeBalance, FeePayment, FeePledge, FeeStructure, Receipt, ReversalReason, StudentDirectoryRow, StudentVoteHeadBalance, VoteHead } from '@/lib/analytics/types';

export default function FinancePage() {
  const [tab, setTab] = useState<'overview' | 'balances' | 'structures' | 'payments' | 'reports'>('overview');
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [pledges, setPledges] = useState<FeePledge[]>([]);
  const [voteHeads, setVoteHeads] = useState<VoteHead[]>([]);
  const [ledgerPayments, setLedgerPayments] = useState<FeePayment[]>([]);
  const [reportSearch, setReportSearch] = useState('');
  const [showVoteHeadSettings, setShowVoteHeadSettings] = useState(false);
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [pledgeDueDate, setPledgeDueDate] = useState('');
  const [pledgeNotes, setPledgeNotes] = useState('');
  const [savingPledge, setSavingPledge] = useState(false);
  const [financeSummary, setFinanceSummary] = useState<Record<string, unknown> | null>(null);
  const [financeRefreshKey, setFinanceRefreshKey] = useState(0);

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
  const [canViewFees, setCanViewFees] = useState(false);
  const [canManageFees, setCanManageFees] = useState(false);
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

  const filteredLedgerPayments = useMemo(() => {
    const query = reportSearch.trim().toLocaleLowerCase();
    if (!query) return ledgerPayments;
    return ledgerPayments.filter((payment) => [payment.student_name, payment.admission_no, payment.reference_number, payment.payment_method, payment.term, payment.academic_year]
      .some((value) => String(value ?? '').toLocaleLowerCase().includes(query)));
  }, [ledgerPayments, reportSearch]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getStudentDirectory(undefined, undefined, undefined, undefined, { signal: controller.signal }),
      getFeeStructures(undefined, undefined, { signal: controller.signal }),
      getVoteHeads({ signal: controller.signal }),
      getFeePayments(undefined, 500, { signal: controller.signal }),
      getFinanceOverview(undefined, undefined, undefined, { signal: controller.signal }),
      getReceipts(undefined, { signal: controller.signal }),
      getMyPermissions({ signal: controller.signal }),
    ])
      .then(([s, st, vh, ledger, summary, rec, me]) => {
        if (!active) return;
        setStudents(s);
        setStructures(st);
        setVoteHeads(vh);
        setLedgerPayments(ledger);
        setFinanceSummary(summary);
        setReceipts(rec);
        const permissions = me?.permissions ?? [];
        setCanViewFees(permissions.includes('view-fees') || permissions.includes('manage-fees'));
        setCanManageFees(permissions.includes('manage-fees'));
        if (s.length > 0) setSelectedStudent((current) => current || s[0].student_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load finance data.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [financeRefreshKey]);

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
  }, [tab, balanceSearch, balanceClass, balanceTerm, balanceYear, balanceFilter, balanceMin, balanceMax, balanceSortBy, balanceSortDir, balancePage, financeRefreshKey]);


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
  }, [selectedStudent, financeRefreshKey]);

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
      // Refresh all finance views from the committed ledger transaction.
      setFinanceRefreshKey((current) => current + 1);
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

  if (!canViewFees && !loading) {
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
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Track fee liabilities, receive payments, manage fee structures and review ledger-based reports.</p>
        </div>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {(['overview', 'balances', 'payments', 'structures', 'reports'] as const).map((t) => (
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
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Charges</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">KES {Number(financeSummary.charges ?? 0).toLocaleString()}</p>
                <p className="mt-1 text-xs text-gray-500">Applicable fees for selected filters</p>
              </div>
            </Card>
            <Card>
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Collected</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">KES {Number(financeSummary.collected ?? 0).toLocaleString()}</p>
                <p className="mt-1 text-xs text-gray-500">Valid payments received</p>
              </div>
            </Card>
            <Card>
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Outstanding</p>
                <p className="mt-1 text-2xl font-bold text-red-700">KES {Number(financeSummary.outstanding ?? 0).toLocaleString()}</p>
                <p className="mt-1 text-xs text-gray-500">Charges minus collected</p>
              </div>
            </Card>
            <Card>
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Collection Rate</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{Number(financeSummary.collection_rate ?? 0).toFixed(1)}%</p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Number(financeSummary.collection_rate ?? 0))}%` }} />
                </div>
              </div>
            </Card>
          </div>

          {/* Reconciliation strip */}
          <Card>
            <div className="p-4 text-sm">
              <span className="font-semibold text-gray-700">Reconciliation: </span>
              <span className="font-mono text-gray-900">
                {Number(financeSummary.charges ?? 0).toLocaleString()} − {Number(financeSummary.collected ?? 0).toLocaleString()} − {Number(financeSummary.waivers ?? 0).toLocaleString()} + {Number(financeSummary.reversals ?? 0).toLocaleString()} = {Number(financeSummary.outstanding ?? 0).toLocaleString()}
              </span>
              <span className="ml-3 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Matches</span>
            </div>
          </Card>

          {/* Secondary counts */}
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Card><div className="p-4 text-center"><p className="text-xs text-gray-500">Learners Billed</p><p className="text-xl font-bold text-gray-900">{Number(financeSummary.learners_billed ?? 0)}</p></div></Card>
            <Card><div className="p-4 text-center"><p className="text-xs text-gray-500">Fully Paid</p><p className="text-xl font-bold text-emerald-700">{Number(financeSummary.fully_paid ?? 0)}</p></div></Card>
            <Card><div className="p-4 text-center"><p className="text-xs text-gray-500">In Arrears</p><p className="text-xl font-bold text-red-700">{Number(financeSummary.in_arrears ?? 0)}</p></div></Card>
            <Card><div className="p-4 text-center"><p className="text-xs text-gray-500">In Credit</p><p className="text-xl font-bold text-blue-700">{Number(financeSummary.in_credit ?? 0)}</p></div></Card>
            <Card><div className="p-4 text-center"><p className="text-xs text-gray-500">Payments</p><p className="text-xl font-bold text-gray-900">{Number(financeSummary.payments_received ?? 0)}</p></div></Card>
            <Card><div className="p-4 text-center"><p className="text-xs text-gray-500">Unmatched Receipts</p><p className="text-xl font-bold text-amber-700">{Number(financeSummary.receipts_unmatched ?? 0)}</p></div></Card>
          </div>

          {/* By class table */}
          <Card>
            <CardHeader title="By Class" />
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Class</th>
                    <th scope="col" className="px-4 py-3 text-right">Learners</th>
                    <th scope="col" className="px-4 py-3 text-right">Billed</th>
                    <th scope="col" className="px-4 py-3 text-right">Collected</th>
                    <th scope="col" className="px-4 py-3 text-right">Outstanding</th>
                    <th scope="col" className="px-4 py-3 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {(financeSummary.by_class as any[] ?? []).map((c: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{c.class_name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.learners}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{Number(c.billed).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{Number(c.collected).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-700">{Number(c.outstanding).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, c.rate)}%` }} />
                          </div>
                          <span>{Number(c.rate).toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Largest balances + Recent payments */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Largest Balances" />
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Learner</th>
                      <th scope="col" className="px-4 py-3">Adm No.</th>
                      <th scope="col" className="px-4 py-3">Class</th>
                      <th scope="col" className="px-4 py-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {(financeSummary.largest_balances as any[] ?? []).map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{r.admission_no}</td>
                        <td className="px-4 py-2.5 text-gray-700">{r.class_name}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium text-red-700">{Number(r.balance).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <CardHeader title="Recent Payments" />
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Receipt</th>
                      <th scope="col" className="px-4 py-3">Learner</th>
                      <th scope="col" className="px-4 py-3 text-right">Amount</th>
                      <th scope="col" className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {(financeSummary.recent_payments as any[] ?? []).map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{r.receipt_number}</td>
                        <td className="px-4 py-2.5 text-gray-700">{r.student_name}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{Number(r.amount).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-gray-600">{new Date(r.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {tab === 'payments' && (
        <div className="space-y-5">
          <Card>
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-gray-900">Payment register</h2>
                <p className="mt-1 text-sm text-gray-600">Select a learner to review their payment history or record a new payment.</p>
                <div className="mt-4 max-w-md">
                  <SelectField id="payment-student" label="Student" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                    <option value="">Select a student</option>
                    {students.map((student) => (
                      <option key={student.student_id} value={student.student_id}>
                        {student.admission_no ? `${student.admission_no} — ` : ''}{student.student_name}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </div>
              {canManageFees && (
                <Button
                  variant="primary"
                  disabled={!selectedStudent}
                  onClick={() => { setPaymentIdempotencyKey(crypto.randomUUID()); setShowPaymentModal(true); }}
                >
                  Record Payment
                </Button>
              )}
            </div>
          </Card>

          {selectedStudent && (
            <Card>
              <CardHeader title="Payment history" />
              {payments.length === 0 ? (
                <EmptyState title="No payments recorded" description="Payments for this learner will appear here after they are recorded." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {payments.map((payment) => (
                        <tr key={payment.payment_id}>
                          <td className="px-4 py-2.5 text-gray-600">{new Date(payment.paid_at).toLocaleDateString('en-GB')}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900">KES {Number(payment.amount).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-gray-700 capitalize">{payment.payment_method || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-600">{payment.reference_number || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {showPaymentModal && selectedStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <h2 className="mb-4 text-lg font-bold text-gray-900">Record Payment</h2>
                <form onSubmit={handleRecordPayment} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField id="pay-amount" label="Amount (KES)" type="number" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
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
                        {voteHeads.map((voteHead) => (
                          <div key={voteHead.vote_head_id} className="flex items-center gap-2">
                            <span className="flex-1 text-sm text-gray-700">{voteHead.name}</span>
                            <input type="number" min="0" step="0.01" value={allocations[voteHead.vote_head_id] ?? ''} onChange={(e) => setAllocations((prev) => ({ ...prev, [voteHead.vote_head_id]: e.target.value }))} className="w-28 rounded-lg border border-gray-300 bg-white px-2 py-1 text-right text-sm" placeholder="0" />
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
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Student payment commitments</h2>
                <p className="mt-1 text-sm text-gray-600">Pledges are recorded against this learner and are not counted as payments received.</p>
              </div>
            </div>
            <div className="p-5">
              {canManageFees && (
                <form
                  className="mb-5 grid gap-3 rounded-lg bg-gray-50 p-4 sm:grid-cols-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!selectedStudent || !pledgeAmount || Number(pledgeAmount) <= 0) return;
                    setSavingPledge(true);
                    setActionError(null);
                    setActionSuccess(null);
                    try {
                      await createFeePledge(selectedStudent, Number(pledgeAmount), pledgeDueDate || undefined, pledgeNotes || undefined);
                      setPledgeAmount('');
                      setPledgeDueDate('');
                      setPledgeNotes('');
                      setActionSuccess('Student pledge saved.');
                      setFinanceRefreshKey((current) => current + 1);
                    } catch (caught) {
                      setActionError(describeAnalyticsError(caught, 'Could not save student pledge.'));
                    } finally {
                      setSavingPledge(false);
                    }
                  }}
                >
                  <TextField id="pledge-amount" label="Pledged amount (KES)" type="number" required value={pledgeAmount} onChange={(event) => setPledgeAmount(event.target.value)} />
                  <TextField id="pledge-due-date" label="Due date" type="date" value={pledgeDueDate} onChange={(event) => setPledgeDueDate(event.target.value)} />
                  <TextField id="pledge-notes" label="Notes" value={pledgeNotes} onChange={(event) => setPledgeNotes(event.target.value)} />
                  <div className="flex items-end">
                    <Button type="submit" disabled={savingPledge || !selectedStudent}>{savingPledge ? 'Saving…' : 'Add pledge'}</Button>
                  </div>
                </form>
              )}
              {pledges.length === 0 ? (
                <p className="py-3 text-sm text-gray-500">No payment commitments recorded for this learner.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Pledged</th>
                        <th className="px-4 py-3">Paid</th>
                        <th className="px-4 py-3">Remaining</th>
                        <th className="px-4 py-3">Due date</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {pledges.map((pledge) => (
                        <tr key={pledge.pledge_id}>
                          <td className="px-4 py-2.5 font-medium text-gray-900">KES {Number(pledge.pledged_amount).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-emerald-700">KES {Number(pledge.paid_amount).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-red-700">KES {Number(pledge.remaining_amount).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-gray-600">{pledge.due_date || '—'}</td>
                          <td className="px-4 py-2.5"><Badge className={pledge.status === 'fulfilled' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}>{pledge.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
          )}
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
          <Card>
            <div className="flex items-center justify-between gap-3 p-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Fee setup settings</h2>
                <p className="mt-1 text-sm text-gray-600">Manage the vote-head reference list used for payment allocations.</p>
              </div>
              <Button variant="secondary" onClick={() => setShowVoteHeadSettings((visible) => !visible)}>{showVoteHeadSettings ? 'Hide settings' : 'Vote-head settings'}</Button>
            </div>
            {showVoteHeadSettings && (
              <div className="overflow-x-auto border-t border-gray-100">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Status</th></tr></thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {voteHeads.map((voteHead) => <tr key={voteHead.vote_head_id}><td className="px-4 py-2.5 font-medium text-gray-900">{voteHead.name}</td><td className="px-4 py-2.5 text-gray-600">{voteHead.code || '—'}</td><td className="px-4 py-2.5 text-gray-700">{voteHead.category_name || '—'}</td><td className="px-4 py-2.5 text-gray-700">{voteHead.is_active ? 'Active' : 'Inactive'}</td></tr>)}
                    {voteHeads.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No vote heads configured.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

        </>
      )}

      {/* Reports Tab — authoritative fee payment ledger and linked receipts */}
      {tab === 'reports' && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-3 p-5">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-gray-900">Payment ledger report</h2>
                <p className="mt-1 text-sm text-gray-600">This register is sourced from fee_payments. Reversals remain visible as separate ledger entries; legacy collections are not added again.</p>
                <div className="mt-4 max-w-md">
                  <TextField id="ledger-search" label="Search ledger" placeholder="Student, admission no., reference or method" value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => {
                  const rows = filteredLedgerPayments.map((payment) => ({
                    date: new Date(payment.paid_at).toLocaleDateString('en-GB'),
                    admission_no: payment.admission_no,
                    student: payment.student_name ?? '',
                    amount: payment.amount,
                    method: payment.payment_method,
                    reference: payment.reference_number ?? '',
                    term: payment.term ?? '',
                    year: payment.academic_year ?? '',
                  }));
                  const csvRows = [['Date', 'Admission No.', 'Student', 'Amount (KES)', 'Method', 'Reference', 'Term', 'Year'], ...rows.map((row) => [row.date, row.admission_no, row.student, row.amount, row.method, row.reference, row.term, row.year])];
                  const csv = '\uFEFF' + csvRows.map((row) => row.map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n');
                  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
                  const anchor = document.createElement('a');
                  anchor.href = url;
                  anchor.download = 'tusome-payment-ledger.csv';
                  anchor.click();
                  URL.revokeObjectURL(url);
                }}>Export CSV</Button>
                <Button variant="secondary" onClick={() => exportToExcel(
                  'tusome-payment-ledger.xlsx',
                  'Payment Ledger',
                  [
                    { header: 'Date', key: 'date', width: 14 },
                    { header: 'Admission No.', key: 'admission_no', width: 18 },
                    { header: 'Student', key: 'student', width: 26 },
                    { header: 'Amount (KES)', key: 'amount', width: 16 },
                    { header: 'Method', key: 'method', width: 14 },
                    { header: 'Reference', key: 'reference', width: 20 },
                    { header: 'Term', key: 'term', width: 12 },
                    { header: 'Year', key: 'year', width: 10 },
                  ],
                  filteredLedgerPayments,
                  (payment, key) => {
                    switch (key) {
                      case 'date': return new Date(payment.paid_at).toLocaleDateString('en-GB');
                      case 'admission_no': return payment.admission_no;
                      case 'student': return payment.student_name ?? '';
                      case 'amount': return payment.amount;
                      case 'method': return payment.payment_method;
                      case 'reference': return payment.reference_number ?? '';
                      case 'term': return payment.term ?? '';
                      case 'year': return payment.academic_year ?? '';
                      default: return '';
                    }
                  }
                )}>Export Excel</Button>
              </div>
            </div>
            <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
              Showing up to {ledgerPayments.length} latest ledger entries returned by the finance API. Export applies the current search.
            </div>
            {filteredLedgerPayments.length === 0 ? (
              <EmptyState title="No matching ledger entries" description="Adjust the search or record a payment." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Admission No.</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3 text-right">Amount (KES)</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredLedgerPayments.map((payment) => (
                      <tr key={payment.payment_id}>
                        <td className="px-4 py-2.5 text-gray-600">{new Date(payment.paid_at).toLocaleDateString('en-GB')}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{payment.admission_no}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{payment.student_name || '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{Number(payment.amount).toLocaleString()}</td>
                        <td className="px-4 py-2.5 capitalize text-gray-700">{payment.payment_method}</td>
                        <td className="px-4 py-2.5 text-gray-600">{payment.reference_number || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Receipt archive" />
            <p className="px-5 pb-3 text-sm text-gray-600">Original receipt records and their existing print/verification links are retained.</p>
            {receipts.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-gray-500">No receipts found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Receipt</th>
                      <th className="px-4 py-3">Invoice reference</th>
                      <th className="px-4 py-3 text-right">Amount (KES)</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {receipts.map((receipt) => (
                      <tr key={receipt.receipt_id}>
                        <td className="px-4 py-2.5 font-medium"><Link href={`/analytics/receipts/${receipt.receipt_id}`} className="text-blue-700 hover:underline">{receipt.receipt_number}</Link></td>
                        <td className="px-4 py-2.5 text-gray-600">{receipt.invoice_number || '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{Number(receipt.amount_paid).toLocaleString()}</td>
                        <td className="px-4 py-2.5 capitalize text-gray-700">{receipt.payment_method}</td>
                        <td className="px-4 py-2.5 text-gray-600">{receipt.reference_number || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600">{new Date(receipt.paid_at).toLocaleDateString('en-GB')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

    </main>
  );
}
