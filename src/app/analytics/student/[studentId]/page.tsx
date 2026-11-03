'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingPanel,
} from '@/components/ui';
import {
  describeAnalyticsError,
  getMarkSheet,
  getStudentExamHistory,
  isAbortError,
} from '@/lib/analytics/api';
import { formatNumber, formatOrdinal, gradeBadgeClass } from '@/lib/analytics/format';
import { isUuid } from '@/lib/analytics/guards';
import type { MarkSheetRow, StudentExamHistoryRow } from '@/lib/analytics/types';

function StudentAnalyticsContent() {
  const params = useParams<{ studentId: string | string[] }>();
  const searchParams = useSearchParams();
  const studentId = Array.isArray(params?.studentId) ? params.studentId[0] : params?.studentId;
  const examId = searchParams.get('exam');

  const [marks, setMarks] = useState<MarkSheetRow[]>([]);
  const [history, setHistory] = useState<StudentExamHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const linkValid = isUuid(studentId) && isUuid(examId);

  useEffect(() => {
    if (!linkValid || !studentId || !examId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    setMarks([]);
    setHistory([]);

    Promise.all([
      getMarkSheet(examId, undefined, undefined, { signal: controller.signal }),
      getStudentExamHistory(studentId, { signal: controller.signal }),
    ])
      .then(([allMarks, studentHistory]) => {
        if (!active) return;
        setMarks(allMarks.filter((row) => row.student_id === studentId));
        setHistory(studentHistory);
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load student analytics');
        setError(describeAnalyticsError(caught, 'Could not load this student.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [studentId, examId, linkValid, reloadToken]);

  const retry = useCallback(() => setReloadToken((value) => value + 1), []);

  if (!linkValid) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card>
          <EmptyState
            title="This student link is incomplete"
            action={
              <Link
                href="/analytics"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Back to analytics
              </Link>
            }
          />
        </Card>
      </main>
    );
  }

  const totalScore = marks.reduce((sum, row) => sum + row.score, 0);
  const passed = marks.filter((row) => row.score >= 40).length;
  const studentName = marks[0]?.student_name ?? 'Student';

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/analytics" className="text-sm font-medium text-blue-700 hover:text-blue-900">
          ← Back to analytics
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/analytics/report/${studentId}?exam=${encodeURIComponent(examId ?? '')}`}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Report card
          </Link>
          <Link
            href={`/analytics/transcript/${studentId}?exam=${encodeURIComponent(examId ?? '')}`}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Transcript
          </Link>
          <Button variant="secondary" onClick={retry} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <LoadingPanel label="Loading student analytics…" />
        </Card>
      ) : error ? (
        <Alert
          tone="error"
          title="Could not load student analytics"
          action={
            <Button variant="danger" size="sm" onClick={retry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={studentName}
            />
            <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
              <Stat label="Subjects" value={marks.length} />
              <Stat label="Total score" value={formatNumber(totalScore)} />
              <Stat
                label="Mean"
                value={marks.length ? `${formatNumber(totalScore / marks.length)}%` : '—'}
              />
              <Stat label="Passed" value={`${passed}/${marks.length}`} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Subject marks" />
            {marks.length === 0 ? (
              <EmptyState
                title="No marks for this exam"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Subject marks and grades</caption>
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left">Subject</th>
                      <th scope="col" className="px-4 py-3 text-right">Score</th>
                      <th scope="col" className="px-4 py-3 text-left">Grade</th>
                      <th scope="col" className="px-4 py-3 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {marks.map((row) => (
                      <tr key={row.subject_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.subject_name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.score)}</td>
                        <td className="px-4 py-3">
                          {row.grade_name ? (
                            <Badge className={gradeBadgeClass(row.grade_name)}>{row.grade_name}</Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
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

          <Card>
            <CardHeader
              title="Performance over time"
            />
            {history.length === 0 ? (
              <EmptyState
                title="No exam history"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Published exam history with mean and position</caption>
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left">Exam</th>
                      <th scope="col" className="px-4 py-3 text-left">Term</th>
                      <th scope="col" className="px-4 py-3 text-right">Mean</th>
                      <th scope="col" className="px-4 py-3 text-left">Grade</th>
                      <th scope="col" className="px-4 py-3 text-right">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map((row) => (
                      <tr key={row.exam_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.exam_name}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {row.term ?? '—'}
                          {row.academic_year ? ` · ${row.academic_year}` : ''}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatNumber(row.mean_score)}%
                        </td>
                        <td className="px-4 py-3">
                          {row.overall_grade ? (
                            <Badge className={gradeBadgeClass(row.overall_grade)}>
                              {row.overall_grade}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                          {formatOrdinal(row.position)} of {row.total_in_exam}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function StudentAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <LoadingPanel label="Loading student analytics…" />
        </main>
      }
    >
      <StudentAnalyticsContent />
    </Suspense>
  );
}
