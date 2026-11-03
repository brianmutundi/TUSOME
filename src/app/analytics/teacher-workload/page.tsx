'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Card, CardHeader, EmptyState, LoadingPanel } from '@/components/ui';
import {
  describeAnalyticsError,
  getTeacherWorkload,
  isAbortError,
} from '@/lib/analytics/api';
import type { TeacherWorkload } from '@/lib/analytics/types';

export default function TeacherWorkloadPage() {
  const [workload, setWorkload] = useState<TeacherWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    getTeacherWorkload({ signal: controller.signal })
      .then((data) => { if (!active) return; setWorkload(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load workload.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  if (loading) return <LoadingPanel label="Loading teacher workload…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load workload">{error}</Alert>
      </main>
    );
  }

  const totalPeriods = workload.reduce((s, w) => s + w.total_periods, 0);
  const totalHours = workload.reduce((s, w) => s + w.total_hours, 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Teacher Workload
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Teacher Workload</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">Teaching periods, hours, and duty assignments per teacher.</p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Teachers</p><p className="text-2xl font-bold text-gray-900">{workload.length}</p></div></Card>
        <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Total Periods</p><p className="text-2xl font-bold text-blue-700">{totalPeriods}</p></div></Card>
        <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Total Hours</p><p className="text-2xl font-bold text-emerald-700">{totalHours.toFixed(1)}</p></div></Card>
      </div>

      {workload.length === 0 ? (
        <EmptyState title="No workload data" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Teacher</th>
                  <th scope="col" className="px-4 py-3">Periods</th>
                  <th scope="col" className="px-4 py-3">Hours</th>
                  <th scope="col" className="px-4 py-3">Subjects</th>
                  <th scope="col" className="px-4 py-3">Classes</th>
                  <th scope="col" className="px-4 py-3">Duties</th>
                  <th scope="col" className="px-4 py-3">Substitutions</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {workload.map((w) => (
                  <tr key={w.teacher_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{w.teacher_name || 'Unnamed'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{w.total_periods}</td>
                    <td className="px-4 py-2.5 text-gray-700">{w.total_hours.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-gray-700">{w.subject_count}</td>
                    <td className="px-4 py-2.5 text-gray-700">{w.class_count}</td>
                    <td className="px-4 py-2.5 text-gray-700">{w.duty_count}</td>
                    <td className="px-4 py-2.5 text-gray-700">{w.substitution_count}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={w.total_periods > 30 ? 'border-red-200 bg-red-50 text-red-800' : w.total_periods < 10 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}>
                        {w.total_periods > 30 ? 'Overloaded' : w.total_periods < 10 ? 'Under-allocated' : 'Normal'}
                      </Badge>
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
