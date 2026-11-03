'use client';

import { useMemo } from 'react';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { SchoolHeader } from '@/components/documents/SchoolHeader';
import { buildAnalysisReport } from '@/lib/analytics/markSheet';
import { formatNumber, gradeBadgeClass } from '@/lib/analytics/format';
import type { MarkSheetRow, MostImprovedRow } from '@/lib/analytics/types';

export function AnalysisReportView({
  markSheet,
  mostImproved,
}: {
  markSheet: MarkSheetRow[];
  mostImproved?: MostImprovedRow[] | null;
}) {
  const report = useMemo(() => buildAnalysisReport(markSheet), [markSheet]);

  if (markSheet.length === 0) {
    return (
      <Card>
        <CardHeader title="Analysis Report" />
        <EmptyState
          title="No data"
        />
      </Card>
    );
  }

  return (
    <Card>
      <SchoolHeader title="Analysis Report" />
      <CardHeader title="Analysis Report" />

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Class average</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {formatNumber(report.class_average)}%
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Subjects</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{report.subject_averages.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Mark entries</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{markSheet.length}</p>
        </div>
      </div>

      <div className="px-4 pb-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Subject performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Per-subject means, spread and broad grade counts</caption>
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">Subject</th>
                <th scope="col" className="px-3 py-2 text-right">Students</th>
                <th scope="col" className="px-3 py-2 text-right">Mean</th>
                <th scope="col" className="px-3 py-2 text-right">High</th>
                <th scope="col" className="px-3 py-2 text-right">Low</th>
                <th scope="col" className="px-3 py-2 text-right">Pass rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.subject_averages.map((subject) => (
                <tr key={subject.subject_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{subject.subject_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{subject.total_students}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatNumber(subject.mean_score)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{subject.highest_score}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{subject.lowest_score}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatNumber(subject.pass_rate)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 pb-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Grade distribution</h3>
          <ul className="space-y-1 text-sm">
            {report.grade_distribution.map((bucket) => (
              <li key={bucket.grade_code} className="flex items-center justify-between gap-2">
                <Badge className={gradeBadgeClass(bucket.grade_name)}>{bucket.grade_name}</Badge>
                <span className="text-gray-600">
                  {bucket.count} · {formatNumber(bucket.percentage)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Top performers</h3>
          <ol className="space-y-1 text-sm">
            {report.top_performers.map((performer) => (
              <li key={performer.student_id} className="flex justify-between gap-2">
                <span className="text-gray-800">
                  {performer.student_name}{' '}
                  <span className="font-mono text-xs text-gray-500">{performer.admission_no}</span>
                </span>
                <span className="tabular-nums text-gray-600">{performer.score}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {mostImproved && mostImproved.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Most improved</h3>
          <ul className="space-y-1 text-sm">
            {mostImproved.slice(0, 5).map((row) => (
              <li key={row.student_id} className="flex justify-between gap-2">
                <span className="text-gray-800">{row.student_name}</span>
                <span className="tabular-nums text-gray-600">
                  {row.delta >= 0 ? '+' : ''}
                  {formatNumber(row.delta)} · {row.previous_exam_name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
