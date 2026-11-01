'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, CardHeader, EmptyState } from '@/components/ui';
import { downloadCsv, timestampSlug, toCsv } from '@/lib/analytics/csv';
import { formatNumber, formatOrdinal, gradeBadgeClass } from '@/lib/analytics/format';
import type { ClassPerformanceStudent } from '@/lib/analytics/types';

type SortKey =
  | 'class_position'
  | 'admission_no'
  | 'student_name'
  | 'stream_name'
  | 'total_score'
  | 'mean_percentage'
  | 'overall_grade'
  | 'overall_points';

const COLUMNS: {
  key: SortKey;
  label: string;
  numeric: boolean;
  className?: string;
}[] = [
  { key: 'class_position', label: 'Pos', numeric: true, className: 'w-16' },
  { key: 'admission_no', label: 'Adm no', numeric: false },
  { key: 'student_name', label: 'Student', numeric: false },
  { key: 'stream_name', label: 'Stream', numeric: false },
  { key: 'total_score', label: 'Total', numeric: true },
  { key: 'mean_percentage', label: 'Mean', numeric: true },
  { key: 'overall_grade', label: 'Grade', numeric: false },
  { key: 'overall_points', label: 'Points', numeric: true },
];

export function ClassPerformanceTable({
  students,
  examId,
  examLabel,
}: {
  students: ClassPerformanceStudent[];
  examId: string;
  examLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('class_position');
  const [ascending, setAscending] = useState(true);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? students.filter(
          (student) =>
            student.student_name.toLowerCase().includes(needle) ||
            student.admission_no.toLowerCase().includes(needle) ||
            (student.stream_name ?? '').toLowerCase().includes(needle)
        )
      : students;

    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const direction = ascending ? 1 : -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * direction;
      }
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (Number(av) - Number(bv)) * direction;
    });
  }, [students, query, sortKey, ascending]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setAscending((value) => !value);
      return;
    }
    setSortKey(key);
    setAscending(key === 'class_position' || key === 'admission_no' || key === 'student_name');
  };

  const exportCsv = () => {
    const csv = toCsv(rows, [
      { header: 'Position', value: (row) => row.class_position },
      { header: 'Admission number', value: (row) => row.admission_no },
      { header: 'Student', value: (row) => row.student_name },
      { header: 'Stream', value: (row) => row.stream_name },
      { header: 'Subjects', value: (row) => row.subjects_count },
      { header: 'Subjects passed', value: (row) => row.passed_count },
      { header: 'Total score', value: (row) => row.total_score },
      { header: 'Mean (%)', value: (row) => row.mean_percentage },
      { header: 'Grade', value: (row) => row.overall_grade },
      { header: 'Points', value: (row) => row.overall_points },
    ]);
    downloadCsv(`class-performance-${examLabel ?? timestampSlug()}.csv`, csv);
  };

  return (
    <Card>
      <CardHeader
        title="Class performance"
        description={`${students.length} student${students.length === 1 ? '' : 's'} · positions follow the current class/stream filters`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="student-search">
              Search students
            </label>
            <input
              id="student-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, adm no, stream"
              className="w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              Export CSV
            </Button>
          </div>
        }
      />
      {students.length === 0 ? (
        <EmptyState
          title="No students with marks"
          description="Choose another exam, class or stream. Students appear here once the exam has marks."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No matching students"
          description="Clear the search to see every student in this selection."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <caption className="sr-only">
              Student totals, mean score, overall grade and class position
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
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Progress
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                  Report
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((student) => {
                const passedAll =
                  student.subjects_count > 0 && student.passed_count >= student.subjects_count;
                return (
                  <tr key={student.student_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 tabular-nums text-gray-700">
                      {formatOrdinal(student.class_position)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{student.admission_no}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{student.student_name}</td>
                    <td className="px-4 py-3 text-gray-600">{student.stream_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(student.total_score)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNumber(student.mean_percentage)}%
                    </td>
                    <td className="px-4 py-3">
                      {student.overall_grade ? (
                        <Badge className={gradeBadgeClass(student.overall_grade)}>
                          {student.overall_grade}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                      {student.overall_points ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${passedAll ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{
                              width: `${
                                student.subjects_count > 0
                                  ? Math.min(100, (student.passed_count / student.subjects_count) * 100)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="whitespace-nowrap text-xs text-gray-600">
                          {student.passed_count}/{student.subjects_count} passed
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <Link
                          href={`/analytics/report/${student.student_id}?exam=${encodeURIComponent(examId)}`}
                          className="font-medium text-blue-700 hover:text-blue-900 hover:underline"
                        >
                          View report
                        </Link>
                        <Link
                          href={`/analytics/student/${student.student_id}?exam=${encodeURIComponent(examId)}`}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline"
                        >
                          Analytics
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
