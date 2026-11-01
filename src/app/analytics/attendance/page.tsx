'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField } from '@/components/ui';
import {
  describeAnalyticsError,
  getAnalyticsFilters,
  getAttendanceForExam,
  isAbortError,
  saveAttendanceForExam,
} from '@/lib/analytics/api';
import type { AnalyticsFilterOptions } from '@/lib/analytics/api';
import type { AttendanceRow, ExamOption } from '@/lib/analytics/types';

const EMPTY_OPTIONS: AnalyticsFilterOptions = { exams: [], classes: [], streams: [] };

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', color: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  { value: 'absent', label: 'Absent', color: 'border-red-200 bg-red-50 text-red-800' },
  { value: 'late', label: 'Late', color: 'border-amber-200 bg-amber-50 text-amber-800' },
  { value: 'excused', label: 'Excused', color: 'border-blue-200 bg-blue-50 text-blue-800' },
];

export default function AttendancePage() {
  const [options, setOptions] = useState<AnalyticsFilterOptions>(EMPTY_OPTIONS);
  const [examId, setExamId] = useState('');
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getAnalyticsFilters({ signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setOptions(data);
        if (data.exams.length > 0) setExamId(data.exams[0].id);
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        setError(describeAnalyticsError(caught, 'Could not load filters.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    if (!examId) { setRows([]); return; }
    const controller = new AbortController();
    let active = true;
    setLoadingRows(true);
    setActionError(null);
    getAttendanceForExam(examId, { signal: controller.signal })
      .then((data) => { if (!active) return; setRows(data); })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        setActionError(describeAnalyticsError(caught, 'Could not load attendance.'));
      })
      .finally(() => { if (active) setLoadingRows(false); });
    return () => { active = false; controller.abort(); };
  }, [examId, reloadToken]);

  const handleStatusChange = (studentId: string, status: string) => {
    setRows((prev) => prev.map((r) => r.student_id === studentId ? { ...r, status } : r));
  };

  const handleSave = async () => {
    if (!examId) return;
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const entries = rows.map((r) => ({ student_id: r.student_id, status: r.status, remarks: r.remarks ?? undefined }));
      await saveAttendanceForExam(examId, entries);
      setActionSuccess('Attendance saved successfully.');
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save attendance.'));
    } finally {
      setSaving(false);
    }
  };

  const presentCount = useMemo(() => rows.filter((r) => r.status === 'present').length, [rows]);
  const absentCount = useMemo(() => rows.filter((r) => r.status === 'absent').length, [rows]);

  if (loading) return <LoadingPanel label="Loading attendance…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load attendance">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Attendance
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Attendance</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Mark and track student attendance per exam.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={handleSave} disabled={saving || rows.length === 0}>
            {saving ? 'Saving…' : 'Save Attendance'}
          </Button>
        </div>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Saved">{actionSuccess}</Alert></div>}

      <Card className="mb-6">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <SelectField id="att-exam" label="Exam" value={examId} onChange={(e) => setExamId(e.target.value)}>
            {options.exams.map((e: ExamOption) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </SelectField>
          <div className="flex items-end gap-4 text-sm">
            <span className="text-gray-600">Present: <strong className="text-emerald-700">{presentCount}</strong></span>
            <span className="text-gray-600">Absent: <strong className="text-red-700">{absentCount}</strong></span>
            <span className="text-gray-600">Total: <strong>{rows.length}</strong></span>
          </div>
        </div>
      </Card>

      {loadingRows ? (
        <LoadingPanel label="Loading attendance…" />
      ) : rows.length === 0 ? (
        <EmptyState title="No attendance records" description="Select an exam to view attendance." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Student</th>
                  <th scope="col" className="px-4 py-3">Admission No</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((r) => (
                  <tr key={r.student_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.student_name || 'Unnamed'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.admission_no}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        {STATUS_OPTIONS.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => handleStatusChange(r.student_id, s.value)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                              r.status === s.value ? s.color : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
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
