'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RadioCardGroup } from '@/components/overlays';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel } from '@/components/ui';
import { ClassPerformanceTable } from '@/components/analytics/ClassPerformanceTable';
import { FilterBar } from '@/components/analytics/FilterBar';
import { MeritListTable } from '@/components/analytics/MeritListTable';
import {
  describeAnalyticsError,
  getAnalyticsFilters,
  getClassPerformance,
  getMarkSheet,
  getMostImproved,
  getStudentReportData,
  isAbortError,
} from '@/lib/analytics/api';
import {
  defaultSelection,
  examsForYear,
  reconcileSelection,
  uniqueAcademicYears,
} from '@/lib/analytics/filters';
import { formatExamLabel } from '@/lib/analytics/format';
import type { AnalyticsFilterOptions } from '@/lib/analytics/api';
import type {
  AnalyticsSelection,
  ClassPerformanceStudent,
  ExamOption,
  MarkSheetRow,
  MostImprovedRow,
  StreamOption,
} from '@/lib/analytics/types';

const EMPTY_OPTIONS: AnalyticsFilterOptions = {
  exams: [] as ExamOption[],
  classes: [],
  streams: [] as StreamOption[],
};

const EMPTY_RESULTS = {
  students: [] as ClassPerformanceStudent[],
  mostImproved: [] as MostImprovedRow[],
  markSheet: [] as MarkSheetRow[],
};

type ReportType = 'exam_only' | 'evaluations_and_exams';

export default function ReportFormsPage() {
  const searchParams = useSearchParams();
  const initialExam = searchParams.get('exam') ?? undefined;
  const initialClass = searchParams.get('class') ?? undefined;
  const initialStream = searchParams.get('stream') ?? undefined;

  const [options, setOptions] = useState<AnalyticsFilterOptions>(EMPTY_OPTIONS);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selection, setSelection] = useState<AnalyticsSelection>({
    academicYear: '',
    examId: initialExam ?? '',
    classId: initialClass ?? '',
    streamId: initialStream ?? '',
  });

  const [results, setResults] = useState(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [reportType, setReportType] = useState<ReportType>('exam_only');

  // Load filter options
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setOptionsLoading(true);
    setOptionsError(null);

    getAnalyticsFilters({ signal: controller.signal })
      .then(({ exams, classes, streams }) => {
        if (!active) return;
        setOptions({ exams, classes, streams });
        setSelection((current) =>
          current.examId
            ? reconcileSelection(current, exams, streams)
            : defaultSelection(exams)
        );
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load filter options');
        setOptionsError(
          describeAnalyticsError(caught, 'Could not load exams, classes and streams.')
        );
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  // Load results when selection changes
  useEffect(() => {
    if (!selection.examId) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    setResults(EMPTY_RESULTS);

    const classId = selection.classId || undefined;
    const streamId = selection.streamId || undefined;

    Promise.all([
      getClassPerformance(selection.examId, classId, streamId, { signal: controller.signal }),
      getMostImproved(selection.examId, classId, streamId, { signal: controller.signal }),
      getMarkSheet(selection.examId, classId, streamId, { signal: controller.signal }),
    ])
      .then(([students, mostImproved, markSheet]) => {
        if (!active) return;
        setResults({ students, mostImproved, markSheet });
        setLastUpdated(new Date());
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load report forms');
        setError(describeAnalyticsError(caught, 'Could not load report forms data.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selection.examId, selection.classId, selection.streamId, reloadToken]);

  const years = useMemo(() => uniqueAcademicYears(options.exams), [options.exams]);

  const changeSelection = useCallback(
    (patch: Partial<AnalyticsSelection>) => {
      setSelection((current) => {
        const next = { ...current, ...patch };
        if (patch.academicYear !== undefined && patch.examId === undefined) next.examId = '';
        return reconcileSelection(next, options.exams, options.streams);
      });
    },
    [options.exams, options.streams]
  );

  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);

  const selectedExam = options.exams.find((e) => e.id === selection.examId) ?? null;
  const selectedStreamName =
    options.streams.find((s) => s.id === selection.streamId)?.name ?? null;
  const visibleExams = examsForYear(options.exams, selection.academicYear);

  const examLabel = selectedExam ? formatExamLabel(selectedExam) : undefined;

  const students = results.students;
  const hasData = students.length > 0;

  const handlePrintAll = useCallback(() => {
    for (const s of students) {
      window.open(
        `/analytics/report/${encodeURIComponent(s.student_id)}?exam=${encodeURIComponent(
          selection.examId
        )}`,
        '_blank'
      );
    }
  }, [students, selection.examId]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">
              Analytics
            </Link>{' '}
            / Report Forms
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            Report Forms
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Generate, preview, and print student report cards for a published exam. Select the
            report type and scope, then print all or individual report cards.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasData && (
            <Button variant="primary" onClick={handlePrintAll}>
              Print All Report Cards
            </Button>
          )}
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {optionsError && (
        <Alert
          tone="error"
          title="Could not load filters"
          action={
            <Button variant="danger" size="sm" onClick={refresh}>
              Retry
            </Button>
          }
        >
          {optionsError}
        </Alert>
      )}

      <div className="mt-4">
        <FilterBar
          years={years}
          exams={options.exams}
          classes={options.classes}
          streams={options.streams}
          selection={selection}
          onChange={changeSelection}
          onRefresh={refresh}
          loading={optionsLoading || loading}
        />

        {/* Report type selector (Zeraki printouts/reportForms reportType) */}
        {selection.examId && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Report type
            </span>
            <RadioCardGroup<ReportType>
              legend="Report type"
              hideLegend
              name="reportType"
              value={reportType}
              onChange={setReportType}
              columns={2}
              options={[
                { value: 'exam_only', label: 'Exam only' },
                { value: 'evaluations_and_exams', label: 'Evaluations & exams' },
              ]}
            />
            <span className="ml-auto text-xs text-gray-500">
              {reportType === 'exam_only'
                ? 'Shows exam marks, grade, mean and position.'
                : 'Shows exam marks plus any CBC/assessment records (where available).'}
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {error && (
          <Alert
            tone="error"
            title="Could not load report forms"
            action={
              <Button variant="danger" size="sm" onClick={refresh}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {!optionsLoading && options.exams.length === 0 && !optionsError ? (
          <Card>
            <EmptyState
              title="No published exams yet"
              action={
                <Button variant="secondary" onClick={refresh}>
                  Check again
                </Button>
              }
            />
          </Card>
        ) : !selection.examId ? (
          optionsLoading ? (
            <LoadingPanel label="Loading exams…" />
          ) : (
            <Card>
              <EmptyState
                title="Choose an exam"
              />
            </Card>
          )
        ) : loading ? (
          <LoadingPanel />
        ) : error ? null : (
          <>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Showing
              </p>
              <p className="text-sm font-medium text-gray-800">
                {examLabel ?? 'Exam'} ·{' '}
                {options.classes.find((c) => c.id === selection.classId)?.name ?? 'All classes'} ·{' '}
                {options.streams.find((s) => s.id === selection.streamId)?.name ?? 'All streams'}
              </p>
            </div>

            {/* Class grade summary */}
            <Card>
              <CardHeader
              title="Class Grade Summary"
              />
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        #
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Student
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Admission No
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Total
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Mean %
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Grade
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Position
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Report Card
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {students.map((s, idx) => (
                      <tr key={s.student_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {s.student_name}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                          {s.admission_no}
                        </td>
                        <td className="px-4 py-2.5 text-gray-800">{s.total_score}</td>
                        <td className="px-4 py-2.5 text-gray-800">
                          {s.mean_percentage.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge className="border-blue-200 bg-blue-50 text-blue-800">
                            {s.overall_grade ?? '—'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{s.class_position}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Link
                            href={`/analytics/report/${encodeURIComponent(
                              s.student_id
                            )}?exam=${encodeURIComponent(selection.examId)}`}
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            View / Print
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Most improved students */}
            {results.mostImproved.length > 0 && (
              <Card>
                <CardHeader
                  title="Most Improved Students"
                />
                <MeritListTable
                  rows={results.mostImproved}
                  loading={false}
                  error={null}
                  examLabel={examLabel}
                />
              </Card>
            )}

            {/* Print all report cards */}
            {hasData && (
              <Card>
                <CardHeader
                  title="Print Report Cards"
                />
                <div className="flex flex-wrap gap-2 p-5">
                  {students.map((s) => (
                    <Link
                      key={s.student_id}
                      href={`/analytics/report/${encodeURIComponent(
                        s.student_id
                      )}?exam=${encodeURIComponent(selection.examId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                    >
                      {s.student_name} ({s.admission_no})
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {/* Links to other report types */}
            <Card>
              <CardHeader
                title="Other report types"
              />
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
                <Link
                  href={`/analytics/mark-sheet?exam=${encodeURIComponent(
                    selection.examId
                  )}${selection.classId ? '&class=' + selection.classId : ''}${
                    selection.streamId ? '&stream=' + selection.streamId : ''
                  }`}
                  className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <p className="text-sm font-semibold text-blue-800">Mark Sheet</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Student × subject marks with grades and points.
                  </p>
                </Link>
                <Link
                  href={`/analytics/analysis?exam=${encodeURIComponent(
                    selection.examId
                  )}${selection.classId ? '&class=' + selection.classId : ''}${
                    selection.streamId ? '&stream=' + selection.streamId : ''
                  }`}
                  className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <p className="text-sm font-semibold text-blue-800">Analysis Report</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Class average, subject breakdown and grade distribution.
                  </p>
                </Link>
                <Link
                  href={students.length > 0 ? `/analytics/transcript/${students[0].student_id}` : '/analytics/students'}
                  className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <p className="text-sm font-semibold text-blue-800">Transcript</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Published exam history grouped by academic year.
                  </p>
                </Link>
              </div>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
