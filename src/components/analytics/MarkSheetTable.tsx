'use client';

import { useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel } from '@/components/ui';
import { downloadCsv, timestampSlug, toCsv } from '@/lib/analytics/csv';
import { formatNumber, gradeBadgeClass } from '@/lib/analytics/format';
import type { MarkSheetRow } from '@/lib/analytics/types';

type SortKey =
  | 'student_name'
  | 'admission_no'
  | 'stream_name'
  | 'subject_name'
  | 'subject_code'
  | 'score'
  | 'grade_name'
  | 'points';

const COLUMNS: { key: SortKey; label: string; numeric: boolean; className?: string }[] = [
  { key: 'student_name', label: 'Student', numeric: false },
  { key: 'admission_no', label: 'Adm no', numeric: false },
  { key: 'stream_name', label: 'Stream', numeric: false },
  { key: 'subject_name', label: 'Subject', numeric: false },
  { key: 'subject_code', label: 'Code', numeric: false },
  { key: 'score', label: 'Score', numeric: true },
  { key: 'grade_name', label: 'Grade', numeric: false },
  { key: 'points', label: 'Points', numeric: true },
];

export function MarkSheetTable({
  rows,
  loading,
  error,
  examLabel,
}: {
  rows: MarkSheetRow[];
  loading: boolean;
  error?: string | null;
  examLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('student_name');
  const [ascending, setAscending] = useState(true);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? rows.filter(
          (row) =>
            row.student_name.toLowerCase().includes(needle) ||
            row.admission_no.toLowerCase().includes(needle) ||
            (row.stream_name ?? '').toLowerCase().includes(needle) ||
            row.subject_name.toLowerCase().includes(needle)
        )
      : rows;

    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const direction = ascending ? 1 : -1;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * direction;
      }
      return (Number(av) - Number(bv)) * direction;
    });
  }, [rows, query, sortKey, ascending]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setAscending((value) => !value);
      return;
    }
    setSortKey(key);
    setAscending(key === 'student_name' || key === 'admission_no' || key === 'subject_name');
  };

  const exportCsv = () => {
    const csv = toCsv(visible, [
      { header: 'Admission number', value: (row) => row.admission_no },
      { header: 'Student', value: (row) => row.student_name },
      { header: 'Class', value: (row) => row.class_name },
      { header: 'Stream', value: (row) => row.stream_name },
      { header: 'Subject', value: (row) => row.subject_name },
      { header: 'Subject code', value: (row) => row.subject_code },
      { header: 'Score', value: (row) => row.score },
      { header: 'Grade', value: (row) => row.grade_name },
      { header: 'Points', value: (row) => row.points },
    ]);
    downloadCsv(`mark-sheet-${examLabel ?? timestampSlug()}.csv`, csv);
  };

  if (loading) {
    return (
      <Card>
        <LoadingPanel label="Loading mark sheet…" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Alert tone="error" title="Could not load mark sheet">
          {error}
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={`Mark Sheet — ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} — student × subject matrix`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="marksheet-search">
              Search mark sheet
            </label>
            <input
              id="marksheet-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, stream, subject"
              className="w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={visible.length === 0}>
              Export CSV
            </Button>
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No marks for this selection"
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No matching entries"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <caption className="sr-only">Student × subject marks for the selected exam</caption>
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {COLUMNS.map((column) => {
                  const active = sortKey === column.key;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={active ? (ascending ? 'ascending' : 'descending') : 'none'}
                      className={`px-4 py-3 ${column.numeric ? 'text-right' : 'text-left'} ${column.className ?? ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-gray-900"
                      >
                        {column.label}
                        <span aria-hidden="true" className={active ? 'text-blue-600' : 'text-gray-300'}>
                          {active ? (ascending ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((row) => (
                <tr key={`${row.student_id}-${row.subject_id}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.student_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.admission_no}</td>
                  <td className="px-4 py-3 text-gray-600">{row.stream_name ?? '—'}</td>
                  <td className="px-4 py-3">{row.subject_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{row.subject_code ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.score)}</td>
                  <td className="px-4 py-3">
                    {row.grade_name ? (
                      <Badge className={gradeBadgeClass(row.grade_name)}>{row.grade_name}</Badge>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {row.points ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
