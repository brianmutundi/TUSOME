'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingPanel,
  SelectField,
  TextField,
} from '@/components/ui';
import {
  describeAnalyticsError,
  getAnalyticsFilters,
  getStudentDirectory,
  isAbortError,
  moveStudent,
} from '@/lib/analytics/api';
import type { AnalyticsFilterOptions } from '@/lib/analytics/api';
import type { ClassOption, StreamOption, StudentDirectoryRow } from '@/lib/analytics/types';

const EMPTY_OPTIONS: AnalyticsFilterOptions = {
  exams: [],
  classes: [],
  streams: [],
};

type MoveAction = 'promote' | 'demote' | 'graduate' | 'expel' | 'transfer';

const MOVE_ACTIONS: ReadonlyArray<{ value: MoveAction; label: string; description: string }> = [
  { value: 'promote', label: 'Promote', description: 'Move selected students to a higher class/stream for the next academic year.' },
  { value: 'demote', label: 'Demote', description: 'Move selected students to a lower class/stream.' },
  { value: 'transfer', label: 'Transfer', description: 'Transfer selected students to another class/stream within the same year.' },
  { value: 'graduate', label: 'Graduate', description: 'Mark selected students as graduated (removes them from active rosters).' },
  { value: 'expel', label: 'Expel', description: 'Mark selected students as expelled.' },
];

export default function MoveStudentsPage() {
  const [options, setOptions] = useState<AnalyticsFilterOptions>(EMPTY_OPTIONS);
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Source filters
  const [sourceClassId, setSourceClassId] = useState('');
  const [sourceStreamId, setSourceStreamId] = useState('');

  // Destination (for promote/demote/transfer)
  const [destClassId, setDestClassId] = useState('');
  const [destStreamId, setDestStreamId] = useState('');
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));

  // Action
  const [action, setAction] = useState<MoveAction>('promote');

  // Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Processing
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getAnalyticsFilters({ signal: controller.signal }),
      getStudentDirectory(
        undefined,
        sourceClassId || undefined,
        sourceStreamId || undefined,
        500,
        { signal: controller.signal }
      ),
    ])
      .then(([filterOpts, studentRows]) => {
        if (!active) return;
        setOptions(filterOpts);
        setStudents(studentRows);
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load move students data');
        setError(describeAnalyticsError(caught, 'Could not load students.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken, sourceClassId, sourceStreamId]);

  const refresh = useCallback(() => {
    setActionError(null);
    setActionSuccess(null);
    setReloadToken((v) => v + 1);
  }, []);

  const streamsForSourceClass = useMemo(() => {
    if (!sourceClassId) return options.streams;
    return options.streams.filter((s) => s.class_id === sourceClassId);
  }, [options.streams, sourceClassId]);

  const streamsForDestClass = useMemo(() => {
    if (!destClassId) return options.streams;
    return options.streams.filter((s) => s.class_id === destClassId);
  }, [options.streams, destClassId]);

  const needsDestination = action === 'promote' || action === 'demote' || action === 'transfer';

  const selectedStudents = useMemo(
    () => students.filter((s) => selectedStudentIds.has(s.student_id)),
    [students, selectedStudentIds]
  );

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedStudentIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedStudentIds(new Set(students.map((s) => s.student_id)));
      setSelectAll(true);
    }
  };

  useEffect(() => {
    setSelectAll(selectedStudentIds.size === students.length && students.length > 0);
  }, [selectedStudentIds, students.length]);

  const handleMove = async () => {
    if (selectedStudentIds.size === 0) {
      setActionError('Select at least one student.');
      return;
    }
    if (needsDestination && !destClassId) {
      setActionError('Select a destination class.');
      return;
    }

    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    setProgress({ done: 0, total: selectedStudentIds.size });

    const studentIds = Array.from(selectedStudentIds);
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const sid of studentIds) {
      try {
        await moveStudent(
          sid,
          action,
          needsDestination ? destClassId : undefined,
          needsDestination ? (destStreamId || undefined) : undefined,
          Number(academicYear)
        );
        successCount++;
      } catch (caught) {
        failCount++;
        errors.push(describeAnalyticsError(caught, `Failed for ${sid}`));
      }
      setProgress({ done: successCount + failCount, total: studentIds.length });
    }

    setProcessing(false);
    setSelectedStudentIds(new Set());
    setSelectAll(false);

    if (failCount === 0) {
      setActionSuccess(
        `Successfully ${action}d ${successCount} student${successCount === 1 ? '' : 's'}.`
      );
    } else {
      setActionError(
        `${successCount} succeeded, ${failCount} failed. ${errors.slice(0, 3).join('; ')}`
      );
    }
    setReloadToken((v) => v + 1);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">
              Analytics
            </Link>{' '}
            /{' '}
            <Link href="/analytics/students" className="text-blue-700 hover:underline">
              Student Directory
            </Link>{' '}
            / Move Students
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            Move Students
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Promote, demote, graduate, expel, or transfer students between classes and streams
            (Zeraki Move Students parity).
          </p>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={loading || processing}>
          Refresh
        </Button>
      </div>

      {actionError && (
        <div className="mb-4">
          <Alert tone="error" title="Action failed">
            {actionError}
          </Alert>
        </div>
      )}

      {actionSuccess && (
        <div className="mb-4">
          <Alert tone="success" title="Completed">
            {actionSuccess}
          </Alert>
        </div>
      )}

      {/* Action selector */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-2 p-4">
          {MOVE_ACTIONS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAction(a.value)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                action === a.value
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <p className="px-4 pb-4 text-xs text-gray-600">
          {MOVE_ACTIONS.find((a) => a.value === action)?.description}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Source panel */}
        <Card>
          <CardHeader title="Source" />
          <div className="space-y-3 p-4">
            <SelectField
              id="source-class"
              label="Source Class"
              value={sourceClassId}
              onChange={(e) => {
                setSourceClassId(e.target.value);
                setSourceStreamId('');
                setSelectedStudentIds(new Set());
              }}
            >
              <option value="">All classes</option>
              {options.classes.map((c: ClassOption) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="source-stream"
              label="Source Stream"
              value={sourceStreamId}
              onChange={(e) => {
                setSourceStreamId(e.target.value);
                setSelectedStudentIds(new Set());
              }}
            >
              <option value="">All streams</option>
              {streamsForSourceClass.map((s: StreamOption) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
          </div>
        </Card>

        {/* Destination panel (for promote/demote/transfer) */}
        {needsDestination && (
          <Card>
            <CardHeader
              title="Destination"
            />
            <div className="space-y-3 p-4">
              <SelectField
                id="dest-class"
                label="Destination Class"
                value={destClassId}
                onChange={(e) => {
                  setDestClassId(e.target.value);
                  setDestStreamId('');
                }}
              >
                <option value="">Select class…</option>
                {options.classes.map((c: ClassOption) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="dest-stream"
                label="Destination Stream"
                value={destStreamId}
                onChange={(e) => setDestStreamId(e.target.value)}
              >
                <option value="">No stream (class-level)</option>
                {streamsForDestClass.map((s: StreamOption) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectField>
              <TextField
                id="academic-year"
                label="Academic Year"
                type="number"
                min={2000}
                max={2100}
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              />
            </div>
          </Card>
        )}

        {/* Student selection */}
        <Card className={needsDestination ? '' : 'lg:col-span-2'}>
          <CardHeader
            title="Select Students"
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleSelectAll}
                disabled={students.length === 0}
              >
                {selectAll ? 'Deselect All' : 'Select All'}
              </Button>
            }
          />
          {loading ? (
            <LoadingPanel label="Loading students…" />
          ) : students.length === 0 ? (
            <EmptyState
              title="No students in this filter"
            />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={toggleSelectAll}
                        aria-label="Select all students"
                      />
                    </th>
                    <th scope="col" className="px-4 py-2">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-2">
                      Admission No
                    </th>
                    <th scope="col" className="px-4 py-2">
                      Class / Stream
                    </th>
                    <th scope="col" className="px-4 py-2">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {students.map((s) => (
                    <tr
                      key={s.student_id}
                      className={`hover:bg-gray-50 ${
                        selectedStudentIds.has(s.student_id) ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.has(s.student_id)}
                          onChange={() => toggleStudent(s.student_id)}
                          aria-label={`Select ${s.full_name}`}
                        />
                      </td>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {s.full_name || 'Unnamed'}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-600">
                        {s.admission_no}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">
                        {[s.class_name, s.stream_name].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          className={
                            s.in_school_status === 'Active'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-gray-300 bg-gray-100 text-gray-700'
                          }
                        >
                          {s.in_school_status || 'Active'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Action button */}
      {selectedStudentIds.size > 0 && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/60 p-4">
          <div>
            <p className="text-sm font-semibold text-blue-900">
              {selectedStudentIds.size} student{selectedStudentIds.size === 1 ? '' : 's'} selected
              for {action}
            </p>
            {processing && (
              <p className="mt-1 text-xs text-blue-800">
                Processing {progress.done} of {progress.total}…
              </p>
            )}
          </div>
          <Button
            variant="primary"
            disabled={processing}
            onClick={handleMove}
          >
            {processing ? 'Processing…' : `Confirm ${action}`}
          </Button>
        </div>
      )}
    </main>
  );
}
