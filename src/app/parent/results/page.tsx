'use client';

import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import {
  createMyChildReportToken,
  describeAnalyticsError,
  getMyChildAttendance,
  getMyChildResults,
  type MyChild,
} from '@/lib/analytics/api';
import { formatScore, groupResults, openShareDocument, scorePercent } from '@/lib/parent/portal';
import { useChildData } from '@/lib/parent/useChildData';
import { ChildGuard, ChildSwitcher, LoadFailure, ScreenSkeleton, SectionHeading, TopBar, cardClass } from '@/components/parent/parts';

const barTone = (s: number) => (s >= 70 ? 'bg-success-600' : s >= 50 ? 'bg-warning-500' : 'bg-danger-600');

function Results({ child }: { child: MyChild }) {
  const results = useChildData(child.studentId, getMyChildResults, 'Could not load results.');
  const attendance = useChildData(child.studentId, (id, o) => getMyChildAttendance(id, undefined, o), 'Could not load attendance.');
  const [picked, setPicked] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const exams = useMemo(() => groupResults(results.data ?? []), [results.data]);
  const exam = exams.find((e) => e.examId === picked) ?? exams[0];

  const openReport = async (examId: string) => {
    setOpening(true);
    setReportError(null);
    try {
      await openShareDocument(() => createMyChildReportToken(child.studentId, examId), (t) => `/report/${t}`);
    } catch (e) {
      setReportError(describeAnalyticsError(e, 'Could not open the report card.'));
    } finally {
      setOpening(false);
    }
  };

  if (results.error) return <div className="px-5"><LoadFailure message={results.error} onRetry={results.retry} /></div>;
  if (!results.data) return <ScreenSkeleton />;

  return (
    <div className="space-y-5 px-5">
      <ChildSwitcher />

      {!exam ? (
        <p className={`${cardClass} p-6 text-center text-sm text-gray-500`}>No published results yet. They appear here once the school publishes an exam.</p>
      ) : (
        <>
          {exams.length > 1 && (
            <div role="tablist" aria-label="Exam" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
              {exams.map((e) => {
                const on = e.examId === exam.examId;
                return (
                  <button
                    key={e.examId}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setPicked(e.examId)}
                    className={`min-h-[2.75rem] shrink-0 rounded-xl px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${on ? 'bg-brand-600 text-white shadow' : 'bg-white text-gray-500 shadow-sm'}`}
                  >
                    {e.name}
                  </button>
                );
              })}
            </div>
          )}

          <section className={cardClass} aria-label={`${exam.name} results`}>
            <p className="px-4 pt-4 text-sm text-gray-500">
              {exam.name}
              {exam.term ? ` · ${exam.term}` : ''}
              {exam.year ? ` ${exam.year}` : ''}
            </p>
            <div className="grid grid-cols-2 gap-2.5 p-4">
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <b className="block text-lg font-extrabold text-brand-600">{exam.average === null ? '–' : `${exam.average.toFixed(1)}%`}</b>
                <span className="text-xs font-semibold text-gray-500">Average</span>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <b className="block text-sm font-extrabold leading-snug text-brand-600">
                  {exam.strongest ? `${exam.strongest.subjectName} (${formatScore(exam.strongest)})` : '–'}
                </b>
                <span className="text-xs font-semibold text-gray-500">Strongest subject</span>
              </div>
            </div>
            <ul>
              {exam.rows.map((r) => (
                <li key={r.subjectName} className="border-t border-gray-100 px-4 py-3">
                  <div className="mb-2 flex justify-between text-sm font-bold text-gray-900">
                    <span>{r.subjectName}</span>
                    <span>{formatScore(r)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-gray-100" aria-hidden="true">
                    <div className={`h-full rounded ${barTone(scorePercent(r))}`} style={{ width: `${scorePercent(r)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-100 p-4">
              <button
                type="button"
                disabled={opening}
                onClick={() => openReport(exam.examId)}
                className="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-brand-100 bg-white px-4 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                {opening ? 'Opening…' : 'View report card'}
              </button>
              {reportError && <p role="alert" className="mt-2 text-sm font-medium text-danger-600">{reportError}</p>}
            </div>
          </section>
        </>
      )}

      <section>
        <SectionHeading title="Attendance" />
        {attendance.error ? (
          <div className="mt-2"><LoadFailure message={attendance.error} onRetry={attendance.retry} /></div>
        ) : !attendance.data ? (
          <p className={`${cardClass} mt-2 p-4 text-sm text-gray-500`}>Loading attendance…</p>
        ) : attendance.data.length === 0 ? (
          <p className={`${cardClass} mt-2 p-4 text-sm text-gray-500`}>No attendance recorded.</p>
        ) : (
          <ul className={`${cardClass} mt-2 divide-y divide-gray-100`}>
            {attendance.data.map((a) => (
              <li key={a.status} className="flex justify-between gap-3 px-4 py-3 text-sm capitalize">
                <span className="text-gray-700">{a.status}</span>
                <span className="font-bold text-gray-900">{a.days}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <>
      <TopBar eyebrow="Exams and attendance" title="Results" />
      <ChildGuard>{(child) => <Results key={child.studentId} child={child} />}</ChildGuard>
    </>
  );
}
