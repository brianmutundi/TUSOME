'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getSubjectsWithDetails,
  isAbortError,
  upsertSubject,
} from '@/lib/analytics/api';
import type { SubjectWithDetails } from '@/lib/analytics/types';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formCompulsory, setFormCompulsory] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    getSubjectsWithDetails({ signal: controller.signal })
      .then((data) => { if (!active) return; setSubjects(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load subjects.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { setActionError('Name is required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertSubject(formName.trim(), formCode.trim() || undefined, formDept.trim() || undefined, formCompulsory);
      setActionSuccess('Subject saved.');
      setShowForm(false);
      setFormName(''); setFormCode(''); setFormDept(''); setFormCompulsory(false);
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save subject.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading subjects…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load subjects">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Subjects
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Subjects</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage school subjects, departments, and papers.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Subject'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Add Subject" />
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField id="subj-name" label="Name" required placeholder="e.g. Mathematics" value={formName} onChange={(e) => setFormName(e.target.value)} />
              <TextField id="subj-code" label="Code" placeholder="e.g. MATH" value={formCode} onChange={(e) => setFormCode(e.target.value)} />
              <TextField id="subj-dept" label="Department" placeholder="e.g. Sciences" value={formDept} onChange={(e) => setFormDept(e.target.value)} />
              <div className="flex items-end gap-2">
                <input type="checkbox" id="subj-comp" checked={formCompulsory} onChange={(e) => setFormCompulsory(e.target.checked)} />
                <label htmlFor="subj-comp" className="text-sm text-gray-700">Compulsory</label>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Subject'}</Button>
            </div>
          </form>
        </Card>
      )}

      {subjects.length === 0 ? (
        <EmptyState title="No subjects" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Department</th>
                  <th scope="col" className="px-4 py-3">Compulsory</th>
                  <th scope="col" className="px-4 py-3">Papers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {subjects.map((s) => (
                  <tr key={s.subject_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{s.subject_name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{s.subject_code || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{s.department}</td>
                    <td className="px-4 py-2.5">
                      {s.is_compulsory && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Yes</Badge>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{s.paper_count}</td>
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
