'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getBehaviourForStudent,
  getStudentDirectory,
  isAbortError,
} from '@/lib/analytics/api';
import type { BehaviourRow, StudentDirectoryRow } from '@/lib/analytics/types';

export default function BehaviourPage() {
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [studentId, setStudentId] = useState('');
  const [rows, setRows] = useState<BehaviourRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getStudentDirectory(undefined, undefined, undefined, undefined, { signal: controller.signal })
      .then((data) => { if (!active) return; setStudents(data); if (data.length > 0) setStudentId(data[0].student_id); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load students.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    if (!studentId) { setRows([]); return; }
    const controller = new AbortController();
    let active = true;
    setLoadingRows(true);
    setActionError(null);
    getBehaviourForStudent(studentId, { signal: controller.signal })
      .then((data) => { if (!active) return; setRows(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load behaviour records.')); })
      .finally(() => { if (active) setLoadingRows(false); });
    return () => { active = false; controller.abort(); };
  }, [studentId]);

  if (loading) return <LoadingPanel label="Loading behaviour…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load behaviour">{error}</Alert>
      </main>
    );
  }

  const selectedStudent = students.find((s) => s.student_id === studentId);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Behaviour
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Student Behaviour</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">View behaviour records for students.</p>
        </div>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="beh-student" label="Student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => (
              <option key={s.student_id} value={s.student_id}>{s.full_name || s.admission_no}</option>
            ))}
          </SelectField>
        </div>
      </Card>

      {loadingRows ? (
        <LoadingPanel label="Loading behaviour records…" />
      ) : rows.length === 0 ? (
        <EmptyState title="No behaviour records" description="No behaviour records found for this student." />
      ) : (
        <Card>
          <CardHeader title={`Behaviour Records — ${selectedStudent?.full_name || ''}`} description={`${rows.length} record(s)`} />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Description</th>
                  <th scope="col" className="px-4 py-3">Severity</th>
                  <th scope="col" className="px-4 py-3">Action Taken</th>
                  <th scope="col" className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <Badge className="border-blue-200 bg-blue-50 text-blue-800">{r.behaviour_type}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-gray-800">{r.description || '—'}</td>
                    <td className="px-4 py-2.5">
                      {r.severity && (
                        <Badge className={
                          r.severity === 'high' ? 'border-red-200 bg-red-50 text-red-800' :
                          r.severity === 'medium' ? 'border-amber-200 bg-amber-50 text-amber-800' :
                          'border-gray-300 bg-gray-100 text-gray-700'
                        }>{r.severity}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{r.action_taken || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {new Date(r.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
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
