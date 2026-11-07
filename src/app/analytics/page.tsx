'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ClassPerformanceTable } from '@/components/analytics/ClassPerformanceTable';
import { FilterBar } from '@/components/analytics/FilterBar';
import { GradeDistributionChart } from '@/components/analytics/GradeDistributionChart';
import { SubjectPerformanceTable } from '@/components/analytics/SubjectPerformanceTable';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { Alert, Button, Card, CardHeader, EmptyState, LoadingPanel } from '@/components/ui';
import {
  describeAnalyticsError,
  getAnalyticsFilters,
  getClassPerformance,
  getGradeDistribution,
  getMarkSheet,
  getMostImproved,
  getSubjectPerformance,
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
  GradeDistribution,
  MarkSheetRow,
  MostImprovedRow,
  StreamOption,
  SubjectPerformance,
} from '@/lib/analytics/types';

import { Can } from '@/components/Can';
import { ClassGradeSummary } from '@/components/analytics/ClassGradeSummary';
import { AnalysisReportView } from '@/components/analytics/AnalysisReportView';

const EMPTY_OPTIONS: AnalyticsFilterOptions = {
  exams: [] as ExamOption[],
  classes: [],
  streams: [] as StreamOption[],
};

const EMPTY_RESULTS = {
  students: [] as ClassPerformanceStudent[],
  grades: [] as GradeDistribution[],
  subjects: [] as SubjectPerformance[],
};

export default function AnalyticsPage() {
  const [options, setOptions] = useState<AnalyticsFilterOptions>(EMPTY_OPTIONS);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selection, setSelection] = useState<AnalyticsSelection>({
    academicYear: '',
    examId: '',
    classId: '',
    streamId: '',
  });

  const [results, setResults] = useState(EMPTY_RESULTS);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // New parity features state
  const [markSheet, setMarkSheet] = useState<MarkSheetRow[]>([]);
  const [markSheetError, setMarkSheetError] = useState<string | null>(null);

  const [mostImproved, setMostImproved] = useState<MostImprovedRow[]>([]);
  const [mostImprovedLoading, setMostImprovedLoading] = useState(false);
  const [mostImprovedError, setMostImprovedError] = useState<string | null>(null);

  // Load filter options. Re-runs on Refresh so newly published exams appear
  // without a full page reload.
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
      .catch((error) => {
        if (!active || isAbortError(error)) return;
        console.error('[analytics] failed to load filter options');
        setOptionsError(
          describeAnalyticsError(error, 'Could not load exams, classes and streams.')
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

  // Load mark-sheet for the current selection
  useEffect(() => {
    if (!selection.examId) {
      setMarkSheet([]);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setMarkSheetError(null);

    getMarkSheet(selection.examId, selection.classId || undefined, selection.streamId || undefined, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!active) return;
        setMarkSheet(data);
        setLastUpdated(new Date());
      })
      .catch((error) => {
        if (!active || isAbortError(error)) return;
        console.error('[analytics] failed to load mark sheet', error);
        setMarkSheetError(describeAnalyticsError(error, 'Could not load mark sheet.'));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selection.examId, selection.classId, selection.streamId, reloadToken]);

  // Load most-improved for the current exam
  useEffect(() => {
    if (!selection.examId) {
      setMostImproved([]);
      setMostImprovedLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setMostImprovedLoading(true);
    setMostImprovedError(null);

    getMostImproved(
      selection.examId,
      selection.classId || undefined,
      selection.streamId || undefined,
      { signal: controller.signal }
    )
      .then((data) => {
        if (!active) return;
        setMostImproved(data);
        setLastUpdated(new Date());
      })
      .catch((error) => {
        if (!active || isAbortError(error)) return;
        console.error('[analytics] failed to load most improved', error);
        setMostImprovedError(
          describeAnalyticsError(error, 'Could not load most improved.')
        );
      })
      .finally(() => {
        if (active) setMostImprovedLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selection.examId, selection.classId, selection.streamId, reloadToken]);

  // Load analytics for the reconciled selection. Abort + active flag guarantee
  // that a slow response cannot overwrite a newer selection.
  useEffect(() => {
    if (!selection.examId) {
      setResults(EMPTY_RESULTS);
      setAnalyticsLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    setResults(EMPTY_RESULTS);

    const classId = selection.classId || undefined;
    const streamId = selection.streamId || undefined;

    Promise.all([
      getClassPerformance(selection.examId, classId, streamId, { signal: controller.signal }),
      getGradeDistribution(selection.examId, classId, streamId, { signal: controller.signal }),
      getSubjectPerformance(selection.examId, classId, streamId, { signal: controller.signal }),
    ])
      .then(([students, grades, subjects]) => {
        if (!active) return;
        setResults({ students, grades, subjects });
        setLastUpdated(new Date());
      })
      .catch((error) => {
        if (!active || isAbortError(error)) return;
        console.error('[analytics] failed to load dashboard');
        setResults(EMPTY_RESULTS);
        setAnalyticsError(
          describeAnalyticsError(error, 'Could not load analytics for this exam.')
        );
      })
      .finally(() => {
        if (active) setAnalyticsLoading(false);
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

  const selectedExam =
    options.exams.find((exam) => exam.id === selection.examId) ?? null;
  const selectedStreamName =
    options.streams.find((item) => item.id === selection.streamId)?.name ?? null;
  const visibleExams = examsForYear(options.exams, selection.academicYear);
  const filterSummary = [
    selectedExam ? formatExamLabel(selectedExam) : null,
    options.classes.find((item) => item.id === selection.classId)?.name ?? 'All classes',
    options.streams.find((item) => item.id === selection.streamId)?.name ?? 'All streams',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Exam performance, grade distribution and student report cards for your school.
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          {lastUpdated ? (
            <p>
              Updated{' '}
              <time dateTime={lastUpdated.toISOString()}>
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
            </p>
          ) : null}
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
          loading={optionsLoading || analyticsLoading}
        />

        <nav
          aria-label="Related views"
          className="mt-3 flex flex-wrap items-center justify-end gap-1 text-sm"
        >
          {selection.examId ? (
            [
              ['Merit List', '/analytics/merit-list'],
              ['Mark Sheet', '/analytics/mark-sheet'],
              ['Analysis', '/analytics/analysis'],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={withSelection(href, selection)}
                className="inline-flex min-h-[2.25rem] items-center rounded-full border border-gray-300 bg-white px-3.5 font-medium text-gray-800 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
              >
                {label}
              </Link>
            ))
          ) : (
            <span className="text-gray-500">Related views appear after you pick an exam</span>
          )}
        </nav>
      </div>

      <div className="mt-6 space-y-6">
        {analyticsError && (
          <Alert
            tone="error"
            title="Could not load analytics"
            action={
              <Button variant="danger" size="sm" onClick={refresh}>
                Retry
              </Button>
            }
          >
            {analyticsError}
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
        ) : analyticsLoading ? (
          <LoadingPanel />
        ) : analyticsError ? null : (
          <>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Showing
              </p>
              <p className="text-sm font-medium text-gray-800">{filterSummary}</p>
            </div>

            <SummaryCards students={results.students} subjects={results.subjects} />

            {markSheetError && (
              <Alert tone="warning" title="Parity reports unavailable">
                {markSheetError}
              </Alert>
            )}

            <div className="mt-6">
              <h2 className="text-xl font-bold text-gray-900">Parity reports</h2>
              <p className="mt-1 text-sm text-gray-600">
                Open a dedicated report for the current exam, class and stream selection.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Can anyOf={['view-merit-list', 'access-printouts']}>
                  <ReportLink href={withSelection('/analytics/merit-list', selection)} title="Merit List" />
                </Can>
                <Can anyOf={['view-assessments', 'access-printouts']}>
                  <ReportLink href={withSelection('/analytics/mark-sheet', selection)} title="Mark Sheet" />
                </Can>
                <Can anyOf={['view-report-forms', 'access-printouts']}>
                  <ReportLink href={withSelection('/analytics/analysis', selection)} title="Analysis Report" />
                </Can>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <ClassGradeSummary
                className={selection.classId}
                streamName={selectedStreamName}
                markSheet={markSheet}
              />
              <AnalysisReportView markSheet={markSheet} mostImproved={mostImproved} />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <GradeDistributionChart grades={results.grades} />
              <SubjectPerformanceTable
                subjects={results.subjects}
                examLabel={selectedExam ? formatExamLabel(selectedExam) : undefined}
              />
            </div>

            <ClassPerformanceTable
              students={results.students}
              examId={selection.examId}
              examLabel={selectedExam ? formatExamLabel(selectedExam) : undefined}
            />

            <Card>
              <CardHeader
                title="About these numbers"
              />
              <div className="grid gap-3 p-5 text-sm text-gray-600 md:grid-cols-3">
                <p>
                  Positions are recalculated for the current class and stream selection. Remove
                  filters to see the whole-exam ranking.
                </p>
                <p>
                  Pass rate uses <strong className="font-semibold text-gray-800">40%</strong> per
                  subject. Broad grades (EE/ME/AE/BE) come from the school&apos;s grading
                  configuration.
                </p>
                <p>
                  Only published exams and students with marks are included. Draft and reopened
                  exams are rejected by the database.
                </p>
              </div>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

function withSelection(path: string, selection: AnalyticsSelection): string {
  const params = new URLSearchParams({ exam: selection.examId });
  if (selection.classId) params.set('class', selection.classId);
  if (selection.streamId) params.set('stream', selection.streamId);
  return `${path}?${params.toString()}`;
}

function ReportLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
    >
      <p className="text-sm font-semibold text-blue-800">{title}</p>
    </Link>
  );
}
