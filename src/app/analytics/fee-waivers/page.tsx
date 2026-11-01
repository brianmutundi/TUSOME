'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  approveFeeWaiver,
  cancelFeeWaiver,
  describeAnalyticsError,
  getFeeWaivers,
  getStudentDirectory,
  isAbortError,
  rejectFeeWaiver,
  submitFeeWaiver,
} from '@/lib/analytics/api';
import type { FeeWaiver, StudentDirectoryRow } from '@/lib/analytics/types';

export default function FeeWaiversPage() {
  const [waivers, setWaivers] = useState<FeeWaiver[]>([]);
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formStudent, setFormStudent] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formRef, setFormRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getFeeWaivers(statusFilter || undefined, undefined, { signal: controller.signal }),
      getStudentDirectory(undefined, undefined, undefined, undefined, { signal: controller.signal }),
    ])
      .then(([w, s]) => {
        if (!active) return;
        setWaivers(w);
        setStudents(s);
        if (s.length > 0 && !formStudent) setFormStudent(s[0].student_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load waivers.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [statusFilter, formStudent]);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudent || !formAmount || !formReason.trim()) { setActionError('Student, amount, and reason are required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await submitFeeWaiver(formStudent, Number(formAmount), formReason.trim(), undefined, formRef.trim() || undefined);
      setActionSuccess('Waiver submitted.');
      setShowForm(false);
      setFormAmount(''); setFormReason(''); setFormRef('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not submit waiver.'));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (waiverId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await approveFeeWaiver(waiverId, reviewNotes.trim() || undefined);
      setActionSuccess('Waiver approved and applied.');
      setReviewId(null);
      setReviewNotes('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not approve waiver.'));
    }
  };

  const handleReject = async (waiverId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await rejectFeeWaiver(waiverId, reviewNotes.trim() || undefined);
      setActionSuccess('Waiver rejected.');
      setReviewId(null);
      setReviewNotes('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not reject waiver.'));
    }
  };

  const handleCancel = async (waiverId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await cancelFeeWaiver(waiverId);
      setActionSuccess('Waiver cancelled.');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not cancel waiver.'));
    }
  };

  if (loading) return <LoadingPanel label="Loading fee waivers…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load fee waivers">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Fee Waivers
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Fee Waivers</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage fee waiver requests with approval workflow.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Request Waiver'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="waiver-status" label="Filter by Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </SelectField>
        </div>
      </Card>

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Submit Waiver Request" />
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField id="waiver-student" label="Student" value={formStudent} onChange={(e) => setFormStudent(e.target.value)}>
                {students.map((s) => (<option key={s.student_id} value={s.student_id}>{s.full_name || s.admission_no}</option>))}
              </SelectField>
              <TextField id="waiver-amount" label="Amount" type="number" required value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
            </div>
            <TextField id="waiver-reason" label="Reason" required value={formReason} onChange={(e) => setFormReason(e.target.value)} />
            <TextField id="waiver-ref" label="Supporting Reference" value={formRef} onChange={(e) => setFormRef(e.target.value)} />
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit Request'}</Button>
            </div>
          </form>
        </Card>
      )}

      {waivers.length === 0 ? (
        <EmptyState title="No waivers" description="No fee waivers found for this filter." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Student</th>
                  <th scope="col" className="px-4 py-3">Amount</th>
                  <th scope="col" className="px-4 py-3">Reason</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Requested By</th>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {waivers.map((w) => (
                  <tr key={w.waiver_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{w.student_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{w.amount}</td>
                    <td className="px-4 py-2.5 text-gray-700">{w.reason}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={
                        w.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                        w.status === 'rejected' ? 'border-red-200 bg-red-50 text-red-800' :
                        w.status === 'cancelled' ? 'border-gray-300 bg-gray-100 text-gray-700' :
                        'border-amber-200 bg-amber-50 text-amber-800'
                      }>{w.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{w.requested_by_name || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{new Date(w.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-2.5">
                      {w.status === 'pending' && (
                        <div className="flex gap-2">
                          {reviewId === w.waiver_id ? (
                            <>
                              <TextField id="review-notes" label="Review Notes" placeholder="Review notes" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
                              <Button variant="primary" onClick={() => handleApprove(w.waiver_id)}>Approve</Button>
                              <Button variant="secondary" onClick={() => handleReject(w.waiver_id)}>Reject</Button>
                            </>
                          ) : (
                            <>
                              <Button variant="secondary" onClick={() => setReviewId(w.waiver_id)}>Review</Button>
                              <Button variant="secondary" onClick={() => handleCancel(w.waiver_id)}>Cancel</Button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
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
