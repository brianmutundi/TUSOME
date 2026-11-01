'use client';

import { useMemo, useState } from 'react';
import { Button, Card, CardHeader, EmptyState } from '@/components/ui';
import { downloadCsv, timestampSlug, toCsv } from '@/lib/analytics/csv';
import { formatNumber } from '@/lib/analytics/format';
import type { SubjectPerformance } from '@/lib/analytics/types';

type SortKey =
  | 'subject_name'
  | 'total_students'
  | 'mean_score'
  | 'highest_score'
  | 'lowest_score'
  | 'pass_rate'
  | 'ee_count'
  | 'me_count'
  | 'ae_count'
  | 'be_count';

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'subject_name', label: 'Subject', numeric: false },
  { key: 'total_students', label: 'Students', numeric: true },
  { key: 'mean_score', label: 'Mean', numeric: true },
  { key: 'highest_score', label: 'High', numeric: true },
  { key: 'lowest_score', label: 'Low', numeric: true },
  { key: 'pass_rate', label: 'Pass rate', numeric: true },
  { key: 'ee_count', label: 'EE', numeric: true },
  { key: 'me_count', label: 'ME', numeric: true },
  { key: 'ae_count', label: 'AE', numeric: true },
  { key: 'be_count', label: 'BE', numeric: true },
];

export function SubjectPerformanceTable({
  subjects,
  examLabel,
}: {
  subjects: SubjectPerformance[];
  examLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('mean_score');
  const [ascending, setAscending] = useState(false);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? subjects.filter(
          (subject) =>
            subject.subject_name.toLowerCase().includes(needle) ||
            subject.subject_code.toLowerCase().includes(needle)
        )
      : subjects;

    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const direction = ascending ? 1 : -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * direction;
      }
      return (Number(av) - Number(bv)) * direction;
    });
  }, [subjects, query, sortKey, ascending]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setAscending((value) => !value);
      return;
    }
    setSortKey(key);
    setAscending(key === 'subject_name');
  };

  const exportCsv = () => {
    const csv = toCsv(rows, [
      { header: 'Subject', value: (row) => row.subject_name },
      { header: 'Code', value: (row) => row.subject_code },
      { header: 'Students', value: (row) => row.total_students },
      { header: 'Mean score', value: (row) => row.mean_score },
      { header: 'Highest score', value: (row) => row.highest_score },
      { header: 'Lowest score', value: (row) => row.lowest_score },
      { header: 'Pass count', value: (row) => row.pass_count },
      { header: 'Pass rate (%)', value: (row) => row.pass_rate },
      { header: 'EE', value: (row) => row.ee_count },
      { header: 'ME', value: (row) => row.me_count },
      { header: 'AE', value: (row) => row.ae_count },
      { header: 'BE', value: (row) => row.be_count },
    ]);
    downloadCsv(
      `subject-performance-${examLabel ?? timestampSlug()}.csv`,
      csv
    );
  };

  return (
    <Card>
      <CardHeader
        title="Subject performance"
        description={`${subjects.length} subject${subjects.length === 1 ? '' : 's'} · broad grades follow the school grading configuration`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="subject-search">
              Search subjects
            </label>
            <input
              id="subject-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search subject or code"
              className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              Export CSV
            </Button>
          </div>
        }
      />
      {subjects.length === 0 ? (
        <EmptyState
          title="No subject data"
          description="Subject performance appears when marks exist for this exam and selection."
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No matching subjects" description="Clear the search to see all subjects." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <caption className="sr-only">
              Subject performance for the selected exam, with pass rate and broad grade counts
            </caption>
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {COLUMNS.map((column) => {
                  const active = sortKey === column.key;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={active ? (ascending ? 'ascending' : 'descending') : 'none'}
                      className={`px-4 py-3 ${column.numeric ? 'text-right' : 'text-left'}`}
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
              {rows.map((subject) => (
                <tr key={subject.subject_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{subject.subject_name}</div>
                    {subject.subject_code && (
                      <div className="text-xs text-gray-500">{subject.subject_code}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{subject.total_students}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(subject.mean_score)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(subject.highest_score)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(subject.lowest_score)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(subject.pass_rate)}%</td>
                  <td className="px-4 py-3 text-right tabular-nums">{subject.ee_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{subject.me_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{subject.ae_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{subject.be_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
