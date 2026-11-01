'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  createCounsellingSession,
  describeAnalyticsError,
  getCounsellingSessions,
  getStudentDirectory,
  isAbortError,
} from '@/lib/analytics/api';
import type { CounsellingSession, StudentDirectoryRow } from '@/lib/analytics/types';

export default function CounsellingPage() {
  const [sessions, setSessions] = useState<CounsellingSession[]>([]);
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('individual');
  const [formTopic, setFormTopic] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getCounsellingSessions(studentId || undefined, { signal: controller.signal }),
      getStudentDirectory(undefined, undefined, undefined, undefined, { signal: controller.signal }),
    ])
      .then(([s, st]) => {
        if (!active) return;
        setSessions(s);
        setStudents(st);
        if (st.length > 0 && !studentId) setStudentId(st[0].student_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load counselling data.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [studentId]);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createCounsellingSession(studentId || undefined, formType, formTopic.trim() || undefined, formNotes.trim() || undefined);
      setActionSuccess('Session created.');
      setShowForm(false);
      setFormTopic(''); setFormNotes('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create session.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading counselling…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load counselling">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Counselling
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Counselling</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage counselling sessions and referrals.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ New Session'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="couns-student" label="Filter by Student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">All Students</option>
            {students.map((s) => (<option key={s.student_id} value={s.student_id}>{s.full_name || s.admission_no}</option>))}
          </SelectField>
        </div>
      </Card>

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="New Counselling Session" />
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="individual">Individual</option>
                  <option value="group">Group</option>
                  <option value="family">Family</option>
                  <option value="crisis">Crisis</option>
                </select>
              </div>
              <TextField id="couns-topic" label="Topic" value={formTopic} onChange={(e) => setFormTopic(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Notes</label>
              <textarea rows={3} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Session'}</Button>
            </div>
          </form>
        </Card>
      )}

      {sessions.length === 0 ? (
        <EmptyState title="No counselling sessions" description="Create your first session above." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Student</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Topic</th>
                  <th scope="col" className="px-4 py-3">Counsellor</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sessions.map((s) => (
                  <tr key={s.session_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs text-gray-600">{new Date(s.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{s.student_name || '—'}</td>
                    <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{s.session_type}</Badge></td>
                    <td className="px-4 py-2.5 text-gray-700">{s.topic || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{s.counsellor_name || '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={s.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>{s.status}</Badge>
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
