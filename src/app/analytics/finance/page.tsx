'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getFeePayments,
  getFeePledges,
  getFeeCollections,
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
import type { FeeBalance, FeeCollection, FeePayment, FeePledge, FeeStructure, ReversalReason, StudentDirectoryRow, StudentVoteHeadBalance, VoteHead, VoteHeadCategory } from '@/lib/analytics/types';

export default function FinancePage() {
  const [tab, setTab] = useState<'balances' | 'structures' | 'payments' | 'pledges' | 'voteheads' | 'collections'>('balances');
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [pledges, setPledges] = useState<FeePledge[]>([]);
  const [voteHeads, setVoteHeads] = useState<VoteHead[]>([]);
  const [collections, setCollections] = useState<FeeCollection[]>([]);
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
      getFeeCollections(undefined, 50, { signal: controller.signal }),
    ])
      .then(([s, st, vh, col]) => {
        if (!active) return;
        setStudents(s);
        setStructures(st);
        setVoteHeads(vh);
        setCollections(col);
        if (s.length > 0) setSelectedStudent(s[0].student_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load finance data.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    if (!selectedStudent) { setBalance(null); setPayments([]); setPledges([]); return; }
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getStudentFeeBalance(selectedStudent, { signal: controller.signal }),
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
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await recordFeePayment(selectedStudent, Number(payAmount), payMethod, payRef || undefined, undefined, undefined, payNotes || undefined);
      setActionSuccess('Payment recorded.');
      setPayAmount(''); setPayRef(''); setPayNotes('');
      // Refresh
      const [b, p] = await Promise.all([
        getStudentFeeBalance(selectedStudent),
        getFeePayments(selectedStudent, 50),
      ]);
      setBalance(b);
      setPayments(p);
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
        {(['balances', 'structures', 'payments', 'pledges', 'voteheads', 'collections'] as const).map((t) => (
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

      {/* Balances Tab */}
      {tab === 'balances' && (
        <>
          <Card className="mb-6">
            <div className="p-5">
              <SelectField id="fin-student" label="Student" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                {students.map((s) => (
                  <option key={s.student_id} value={s.student_id}>{s.full_name || s.admission_no}</option>
                ))}
              </SelectField>
            </div>
          </Card>

          {balance && (
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Total Fees</p><p className="text-2xl font-bold text-gray-900">{balance.total_fees}</p></div></Card>
              <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Total Paid</p><p className="text-2xl font-bold text-emerald-700">{balance.total_paid}</p></div></Card>
              <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Balance</p><p className="text-2xl font-bold text-red-700">{balance.balance}</p></div></Card>
            </div>
          )}

          {/* Record Payment Form */}
          <Card className="mb-6">
            <CardHeader title="Record Payment" />
            <form onSubmit={handleRecordPayment} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? 'Recording…' : 'Record Payment'}</Button>
              </div>
            </form>
          </Card>

          {/* Payment History */}
          {payments.length > 0 && (
            <Card>
              <CardHeader title="Payment History" description={`${payments.length} payment(s)`} />
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Date</th>
                      <th scope="col" className="px-4 py-3">Amount</th>
                      <th scope="col" className="px-4 py-3">Method</th>
                      <th scope="col" className="px-4 py-3">Reference</th>
                      <th scope="col" className="px-4 py-3">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {payments.map((p) => (
                      <tr key={p.payment_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-xs text-gray-600">{new Date(p.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{p.amount}</td>
                        <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{p.payment_method}</Badge></td>
                        <td className="px-4 py-2.5 text-gray-600">{p.reference_number || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{p.recorded_by_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            <EmptyState title="No fee structures" description="Create your first fee structure above." />
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
            <EmptyState title="No pledges" description="No fee pledges found for this student." />
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
          <CardHeader title="Vote Heads" description="Fee components (Tuition, Transport, etc.)" />
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
          {collections.length === 0 ? (
            <EmptyState title="No collections" description="Fee collections will appear here." />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Date</th>
                      <th scope="col" className="px-4 py-3">Student</th>
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

    </main>
  );
}
