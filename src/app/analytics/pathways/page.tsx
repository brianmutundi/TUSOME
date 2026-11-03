'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getPathways,
  getStudentDirectory,
  isAbortError,
  upsertPathway,
  assignStudentPathway,
} from '@/lib/analytics/api';
import type { Pathway, StudentDirectoryRow } from '@/lib/analytics/types';

export default function PathwaysPage() {
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formTrack, setFormTrack] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignPathwayId, setAssignPathwayId] = useState('');

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getPathways({ signal: controller.signal }),
      getStudentDirectory(undefined, undefined, undefined, undefined, { signal: controller.signal }),
    ])
      .then(([p, s]) => {
        if (!active) return;
        setPathways(p);
        setStudents(s);
        if (s.length > 0) setAssignStudentId(s[0].student_id);
        if (p.length > 0) setAssignPathwayId(p[0].id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load pathways.')); })
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
      await upsertPathway(formName.trim(), formTrack.trim() || undefined, formDesc.trim() || undefined);
      setActionSuccess('Pathway saved.');
      setShowForm(false);
      setFormName(''); setFormTrack(''); setFormDesc('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save pathway.'));
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!assignStudentId || !assignPathwayId) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await assignStudentPathway(assignStudentId, assignPathwayId);
      const student = students.find((s) => s.student_id === assignStudentId);
      const pathway = pathways.find((p) => p.id === assignPathwayId);
      setActionSuccess(`Assigned ${pathway?.name} to ${student?.full_name || 'student'}.`);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not assign pathway.'));
    }
  };

  if (loading) return <LoadingPanel label="Loading pathways…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load pathways">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Pathways
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Pathways</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage student pathways (e.g., STEM, Arts, Sports) and assign to students.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Pathway'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Add Pathway" />
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="pw-name" label="Name" required placeholder="e.g. STEM" value={formName} onChange={(e) => setFormName(e.target.value)} />
              <TextField id="pw-track" label="Track" placeholder="e.g. Science" value={formTrack} onChange={(e) => setFormTrack(e.target.value)} />
              <TextField id="pw-desc" label="Description" placeholder="Optional" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Pathway'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader title="Assign Pathway to Student" />
        <div className="flex flex-wrap items-end gap-4 p-5">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Student</label>
            <select value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
              {students.map((s) => (<option key={s.student_id} value={s.student_id}>{s.full_name || s.admission_no}</option>))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Pathway</label>
            <select value={assignPathwayId} onChange={(e) => setAssignPathwayId(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
              {pathways.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
          <Button onClick={handleAssign}>Assign</Button>
        </div>
      </Card>

      {pathways.length === 0 ? (
        <EmptyState title="No pathways" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Track</th>
                  <th scope="col" className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pathways.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.track || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{p.description || '—'}</td>
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
