'use client';

import { useMemo, useState } from 'react';
import { Button, Card, CardHeader, EmptyState, LoadingPanel, Alert } from '@/components/ui';
import { downloadCsv, timestampSlug, toCsv } from '@/lib/analytics/csv';
import { formatNumber, formatOrdinal } from '@/lib/analytics/format';
import type { MostImprovedRow } from '@/lib/analytics/types';

type SortKey = 'student_name' | 'admission_no' | 'stream_name' | 'current_mean' | 'previous_mean' | 'delta';

const COLUMNS: { key: SortKey; label: string; numeric: boolean; className?: string }[] = [
  { key: 'student_name', label: 'Student', numeric: false },
  { key: 'admission_no', label: 'Adm no', numeric: false },
  { key: 'stream_name', label: 'Stream', numeric: false },
  { key: 'current_mean', label: 'Current mean', numeric: true },
  { key: 'previous_mean', label: 'Previous mean', numeric: true },
  { key: 'delta', label: 'Improvement', numeric: true },
];

export function MeritListTable({
  rows,
  loading,
  error,
  examLabel,
}: {
  rows: MostImprovedRow[];
  loading: boolean;
  error?: string | null;
  examLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('delta');
  const [ascending, setAscending] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? rows.filter(
          (row) =>
            row.student_name.toLowerCase().includes(needle) ||
            row.admission_no.toLowerCase().includes(needle) ||
            (row.stream_name ?? '').toLowerCase().includes(needle)
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
    setAscending(key === 'student_name' || key === 'admission_no');
  };

  const exportCsv = () => {
    const csv = toCsv(visible, [
      { header: 'Rank', value: (row) => visible.indexOf(row) + 1 },
      { header: 'Admission number', value: (row) => row.admission_no },
      { header: 'Student', value: (row) => row.student_name },
      { header: 'Stream', value: (row) => row.stream_name },
      { header: 'Current mean', value: (row) => row.current_mean },
      { header: 'Previous mean', value: (row) => row.previous_mean },
      { header: 'Improvement', value: (row) => row.delta },
      { header: 'Previous exam', value: (row) => row.previous_exam_name },
    ]);
    downloadCsv(`merit-list-${examLabel ?? timestampSlug()}.csv`, csv);
  };

  if (loading) {
    return (
      <Card>
        <LoadingPanel label="Loading merit list…" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Alert tone="error" title="Could not load merit list">
          {error}
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Merit List · Most Improved"
        description={`${rows.length} student${rows.length === 1 ? '' : 's'} with a previous published exam`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="merit-search">
              Search students
            </label>
            <input
              id="merit-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, adm no, stream"
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
          title="No comparison available"
          description="Most improved needs an earlier published exam for at least one student."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No matching students"
          description="Clear the search to see every student in this list."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <caption className="sr-only">
              Students ranked by improvement against their previous published exam
            </caption>
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="w-16 px-4 py-3 text-right">
                  Rank
                </th>
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
                <th scope="col" className="px-4 py-3 text-left">
                  Previous exam
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((row, index) => (
                <tr key={row.student_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {formatOrdinal(index + 1)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.student_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.admission_no}</td>
                  <td className="px-4 py-3 text-gray-600">{row.stream_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(row.current_mean)}%
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(row.previous_mean)}%
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${
                      row.delta >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {row.delta >= 0 ? '+' : ''}
                    {formatNumber(row.delta)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.previous_exam_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
