'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField } from '@/components/ui';
import {
  describeAnalyticsError,
  getAnalyticsFilters,
  getDailyAttendance,
  isAbortError,
  saveDailyAttendance,
} from '@/lib/analytics/api';
import type { AnalyticsFilterOptions } from '@/lib/analytics/api';
import type { ClassOption, DailyAttendanceRow, StreamOption } from '@/lib/analytics/types';

export default function DailyAttendancePage() {
  const [options, setOptions] = useState<AnalyticsFilterOptions>({ exams: [], classes: [], streams: [] });
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [rows, setRows] = useState<DailyAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getAnalyticsFilters({ signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setOptions(data);
        if (data.classes.length > 0) setClassId(data.classes[0].id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load filters.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  const loadRows = useCallback(() => {
    if (!date) { setRows([]); return; }
    const controller = new AbortController();
    let active = true;
    setLoadingRows(true);
    setActionError(null);
    getDailyAttendance(date, classId || undefined, streamId || undefined, { signal: controller.signal })
      .then((data) => { if (!active) return; setRows(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load attendance.')); })
      .finally(() => { if (active) setLoadingRows(false); });
    return () => { active = false; controller.abort(); };
  }, [date, classId, streamId]);

  useEffect(() => { const cleanup = loadRows(); return cleanup; }, [loadRows]);

  const handleStatusChange = (studentId: string, status: string) => {
    setRows((prev) => prev.map((r) => r.student_id === studentId ? { ...r, status } : r));
  };

  const handleSave = async () => {
    if (!date || rows.length === 0) return;
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const entries = rows.map((r) => ({ student_id: r.student_id, status: r.status, absence_reason: r.absence_reason ?? undefined, remarks: r.remarks ?? undefined }));
      const count = await saveDailyAttendance(date, entries);
      setActionSuccess(`Attendance saved for ${count} students.`);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save attendance.'));
    } finally {
      setSaving(false);
    }
  };

  const presentCount = rows.filter((r) => r.status === 'present').length;
  const absentCount = rows.filter((r) => r.status === 'absent').length;

  if (loading) return <LoadingPanel label="Loading daily attendance…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load daily attendance">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Daily Attendance
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Daily Attendance</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Mark daily class attendance with absence reasons.</p>
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving || rows.length === 0}>
          {saving ? 'Saving…' : 'Save Attendance'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Saved">{actionSuccess}</Alert></div>}

      <Card className="mb-6">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
          </div>
          <SelectField id="da-class" label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {options.classes.map((c: ClassOption) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </SelectField>
          <SelectField id="da-stream" label="Stream" value={streamId} onChange={(e) => setStreamId(e.target.value)}>
            <option value="">All Streams</option>
            {options.streams.map((s: StreamOption) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </SelectField>
        </div>
        <div className="flex items-center gap-4 px-5 pb-4 text-sm">
          <span className="text-gray-600">Present: <strong className="text-emerald-700">{presentCount}</strong></span>
          <span className="text-gray-600">Absent: <strong className="text-red-700">{absentCount}</strong></span>
          <span className="text-gray-600">Total: <strong>{rows.length}</strong></span>
        </div>
      </Card>

      {loadingRows ? (
        <LoadingPanel label="Loading attendance…" />
      ) : rows.length === 0 ? (
        <EmptyState title="No students" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Student</th>
                  <th scope="col" className="px-4 py-3">Admission No</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Absence Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((r) => (
                  <tr key={r.student_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.student_name || 'Unnamed'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.admission_no}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {['present', 'absent', 'late', 'excused', 'sick'].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleStatusChange(r.student_id, s)}
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
                              r.status === s
                                ? s === 'present' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                                  s === 'absent' ? 'border-red-200 bg-red-50 text-red-800' :
                                  s === 'late' ? 'border-amber-200 bg-amber-50 text-amber-800' :
                                  'border-blue-200 bg-blue-50 text-blue-800'
                                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.status === 'absent' || r.status === 'sick' ? (
                        <input
                          type="text"
                          placeholder="Reason"
                          value={r.absence_reason || ''}
                          onChange={(e) => setRows((prev) => prev.map((row) => row.student_id === r.student_id ? { ...row, absence_reason: e.target.value } : row))}
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        />
                      ) : (
                        <span className="text-gray-400">—</span>
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
