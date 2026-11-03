'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel } from '@/components/ui';
import { SchoolHeader } from '@/components/documents/SchoolHeader';
import { describeAnalyticsError, getStudentExamHistory, isAbortError } from '@/lib/analytics/api';
import { formatNumber, formatOrdinal, gradeBadgeClass } from '@/lib/analytics/format';
import { isUuid } from '@/lib/analytics/guards';
import type { StudentExamHistoryRow } from '@/lib/analytics/types';

function TranscriptContent() {
  const params = useParams<{ studentId: string | string[] }>();
  const studentId = Array.isArray(params?.studentId) ? params.studentId[0] : params?.studentId;

  const [history, setHistory] = useState<StudentExamHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const linkValid = isUuid(studentId);

  useEffect(() => {
    if (!linkValid || !studentId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    setHistory([]);

    getStudentExamHistory(studentId, { signal: controller.signal })
      .then((data) => {
        if (active) setHistory(data);
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load transcript');
        setError(describeAnalyticsError(caught, 'Could not load this transcript.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [studentId, linkValid, reloadToken]);

  const retry = useCallback(() => setReloadToken((value) => value + 1), []);

  const years = useMemo(
    () =>
      [...new Set(history.map((row) => row.academic_year).filter((year): year is number => year !== null))]
        .sort((a, b) => b - a),
    [history]
  );

  const print = () => window.print();

  if (!linkValid) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card>
          <EmptyState
            title="This transcript link is incomplete"
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/analytics" className="text-sm font-medium text-blue-700 hover:text-blue-900">
          ← Back to analytics
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={retry} disabled={loading}>
            Refresh
          </Button>
          <Button onClick={print} disabled={loading || history.length === 0}>
            Print / Save as PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <LoadingPanel label="Loading transcript…" />
        </Card>
      ) : error ? (
        <Alert
          tone="error"
          title="Could not load transcript"
          action={
            <Button variant="danger" size="sm" onClick={retry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : (
        <Card>
          <CardHeader title="Academic Transcript" />
          {history.length === 0 ? (
            <EmptyState
              title="No transcript entries"
            />
          ) : (
            <div className="space-y-6 p-4">
              {years.map((year) => (
                <section key={year}>
                  <h3 className="mb-2 text-sm font-semibold text-gray-900">Academic year {year}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">Exams in {year}</caption>
                      <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th scope="col" className="px-4 py-2 text-left">Exam</th>
                          <th scope="col" className="px-4 py-2 text-left">Term</th>
                          <th scope="col" className="px-4 py-2 text-right">Mean</th>
                          <th scope="col" className="px-4 py-2 text-left">Grade</th>
                          <th scope="col" className="px-4 py-2 text-right">Position</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {history
                          .filter((row) => row.academic_year === year)
                          .map((row) => (
                            <tr key={row.exam_id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium text-gray-900">{row.exam_name}</td>
                              <td className="px-4 py-2 text-gray-600">{row.term ?? '—'}</td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {formatNumber(row.mean_score)}%
                              </td>
                              <td className="px-4 py-2">
                                {row.overall_grade ? (
                                  <Badge className={gradeBadgeClass(row.overall_grade)}>
                                    {row.overall_grade}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                                {formatOrdinal(row.position)} of {row.total_in_exam}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </Card>
      )}
    </main>
  );
}

export default function StudentTranscriptPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <LoadingPanel label="Loading transcript…" />
        </main>
      }
    >
      <TranscriptContent />
    </Suspense>
  );
}
