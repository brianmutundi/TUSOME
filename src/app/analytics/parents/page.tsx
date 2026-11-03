'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField } from '@/components/ui';
import {
  describeAnalyticsError,
  getParents,
  getStudentDirectory,
  isAbortError,
  linkParentStudent,
  unlinkParentStudent,
  getParentStudentLinks,
} from '@/lib/analytics/api';
import type { ParentRow, ParentStudentLink, StudentDirectoryRow } from '@/lib/analytics/types';

export default function ParentsPage() {
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [links, setLinks] = useState<ParentStudentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [selectedParent, setSelectedParent] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [relationship, setRelationship] = useState('parent');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getParents({ signal: controller.signal }),
      getStudentDirectory(undefined, undefined, undefined, undefined, { signal: controller.signal }),
      getParentStudentLinks(undefined, undefined, { signal: controller.signal }),
    ])
      .then(([p, s, l]) => {
        if (!active) return;
        setParents(p);
        setStudents(s);
        setLinks(l);
        if (p.length > 0) setSelectedParent(p[0].parent_id);
        if (s.length > 0) setSelectedStudent(s[0].student_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load parent data.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleLink = async () => {
    if (!selectedParent || !selectedStudent) return;
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await linkParentStudent(selectedParent, selectedStudent, relationship);
      setActionSuccess('Parent linked to student.');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not link parent.'));
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async (linkId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await unlinkParentStudent(linkId);
      setActionSuccess('Link removed.');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not unlink.'));
    }
  };

  if (loading) return <LoadingPanel label="Loading parents…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load parents">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Parents
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Parent Portal</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Link parents to students and manage parent-student relationships.</p>
        </div>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {/* Link form */}
      <Card className="mb-6">
        <CardHeader title="Link Parent to Student" />
        <div className="flex flex-wrap items-end gap-4 p-5">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Parent</label>
            <select value={selectedParent} onChange={(e) => setSelectedParent(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
              {parents.map((p) => (<option key={p.parent_id} value={p.parent_id}>{p.full_name || p.email}</option>))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Student</label>
            <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
              {students.map((s) => (<option key={s.student_id} value={s.student_id}>{s.full_name || s.admission_no}</option>))}
            </select>
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Relationship</label>
            <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
              <option value="parent">Parent</option>
              <option value="guardian">Guardian</option>
              <option value="mother">Mother</option>
              <option value="father">Father</option>
              <option value="sponsor">Sponsor</option>
            </select>
          </div>
          <Button onClick={handleLink} disabled={saving}>{saving ? 'Linking…' : 'Link'}</Button>
        </div>
      </Card>

      {/* Links table */}
      {links.length === 0 ? (
        <EmptyState title="No parent-student links" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Parent</th>
                  <th scope="col" className="px-4 py-3">Student</th>
                  <th scope="col" className="px-4 py-3">Admission No</th>
                  <th scope="col" className="px-4 py-3">Relationship</th>
                  <th scope="col" className="px-4 py-3">Primary</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {links.map((l) => (
                  <tr key={l.link_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{l.parent_name || l.parent_email || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{l.student_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{l.admission_no}</td>
                    <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{l.relationship}</Badge></td>
                    <td className="px-4 py-2.5">{l.is_primary ? '✓' : '—'}</td>
                    <td className="px-4 py-2.5">
                      <Button variant="secondary" onClick={() => handleUnlink(l.link_id)}>Unlink</Button>
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
