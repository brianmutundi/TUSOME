'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  approveLeaveRequest,
  describeAnalyticsError,
  getLeaveRequests,
  getLeaveTypes,
  isAbortError,
  rejectLeaveRequest,
  submitLeaveRequest,
} from '@/lib/analytics/api';
import type { LeaveRequest, LeaveType } from '@/lib/analytics/types';

export default function LeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formReason, setFormReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getLeaveRequests(statusFilter || undefined, undefined, { signal: controller.signal }),
      getLeaveTypes({ signal: controller.signal }),
    ])
      .then(([r, t]) => {
        if (!active) return;
        setRequests(r);
        setLeaveTypes(t);
        if (t.length > 0 && !formType) setFormType(t[0].leave_type_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load leave data.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [statusFilter, formType]);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formType || !formStart || !formEnd) { setActionError('Type and dates required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await submitLeaveRequest(formType, formStart, formEnd, formReason.trim() || undefined);
      setActionSuccess('Leave request submitted.');
      setShowForm(false);
      setFormStart(''); setFormEnd(''); setFormReason('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not submit leave request.'));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await approveLeaveRequest(id, reviewNotes.trim() || undefined);
      setActionSuccess('Leave approved.');
      setReviewId(null);
      setReviewNotes('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not approve leave.'));
    }
  };

  const handleReject = async (id: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await rejectLeaveRequest(id, reviewNotes.trim() || undefined);
      setActionSuccess('Leave rejected.');
      setReviewId(null);
      setReviewNotes('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not reject leave.'));
    }
  };

  if (loading) return <LoadingPanel label="Loading leave…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load leave">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Leave
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Leave Management</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage staff leave requests and approvals.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Request Leave'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="leave-status" label="Filter by Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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
          <CardHeader title="Submit Leave Request" />
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField id="leave-type" label="Leave Type" value={formType} onChange={(e) => setFormType(e.target.value)}>
                {leaveTypes.map((t) => (<option key={t.leave_type_id} value={t.leave_type_id}>{t.name}</option>))}
              </SelectField>
              <TextField id="leave-start" label="Start Date" type="date" required value={formStart} onChange={(e) => setFormStart(e.target.value)} />
              <TextField id="leave-end" label="End Date" type="date" required value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
              <TextField id="leave-reason" label="Reason" value={formReason} onChange={(e) => setFormReason(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit Request'}</Button>
            </div>
          </form>
        </Card>
      )}

      {requests.length === 0 ? (
        <EmptyState title="No leave requests" description="Submit your first leave request above." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Staff</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Start</th>
                  <th scope="col" className="px-4 py-3">End</th>
                  <th scope="col" className="px-4 py-3">Days</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {requests.map((r) => (
                  <tr key={r.request_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.staff_name || '—'}</td>
                    <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{r.leave_type_name}</Badge></td>
                    <td className="px-4 py-2.5 text-gray-600">{r.start_date}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.end_date}</td>
                    <td className="px-4 py-2.5 text-gray-700">{r.days_requested}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={r.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : r.status === 'rejected' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.status === 'pending' && (
                        <div className="flex gap-2">
                          {reviewId === r.request_id ? (
                            <>
                              <TextField id="review-notes" label="Notes" placeholder="Review notes" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
                              <Button variant="primary" onClick={() => handleApprove(r.request_id)}>Approve</Button>
                              <Button variant="secondary" onClick={() => handleReject(r.request_id)}>Reject</Button>
                            </>
                          ) : (
                            <Button variant="secondary" onClick={() => setReviewId(r.request_id)}>Review</Button>
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
