import { Badge } from '@/components/ui';
import {
  formatNumber,
  formatOrdinal,
  formatReportExam,
  gradeBadgeClass,
} from '@/lib/analytics/format';
import type { StudentReportData } from '@/lib/analytics/types';

import { useEffect, useState } from 'react';
import { getSchoolProfile } from '@/lib/analytics/api';
import type { SchoolProfile } from '@/lib/analytics/types';

export function StudentReportCard({ report }: { report: StudentReportData }) {
  const { student, school, exam, subjects, summary } = report;
  const classLabel = [student.class, student.stream].filter(Boolean).join(' · ');
  const hasSubjects = subjects.length > 0;
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  useEffect(() => { getSchoolProfile().then(setProfile).catch(() => setProfile(null)); }, []);

  return (
    <article className="print-report rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
      <header className="border-b border-gray-200 pb-5 text-center">
        {profile?.logo_url && (
          <img src={profile.logo_url} alt={profile.name ? `${profile.name} logo` : 'School logo'} className="mx-auto mb-3 h-16 w-auto object-contain" />
        )}
        <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-gray-600">
          Student report card
        </p>
        <p className="mt-2 text-sm text-gray-700">{formatReportExam(exam)}</p>
      </header>

      <section aria-labelledby="student-details" className="mt-6">
        <h2 id="student-details" className="sr-only">
          Student details
        </h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 font-semibold text-gray-700">Student name</dt>
            <dd className="text-gray-900">{student.name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 font-semibold text-gray-700">Admission no</dt>
            <dd className="font-mono text-gray-900">{student.admission_no}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 font-semibold text-gray-700">Class</dt>
            <dd className="text-gray-900">{classLabel || '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 font-semibold text-gray-700">Academic year</dt>
            <dd className="text-gray-900">
              {student.academic_year ?? exam.year ?? '—'}
              {student.academic_year && exam.year && student.academic_year !== exam.year ? (
                <span className="ml-2 text-xs text-gray-500">(exam year {exam.year})</span>
              ) : null}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 font-semibold text-gray-700">Gender</dt>
            <dd className="text-gray-900">{student.gender ?? '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 font-semibold text-gray-700">Assessment</dt>
            <dd className="text-gray-900">{exam.assessment_component || exam.term || '—'}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="subject-results" className="mt-8">
        <h2 id="subject-results" className="mb-3 text-base font-semibold text-gray-900">
          Subject results
        </h2>
        {hasSubjects ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Subject scores, grades and points for {student.name}
              </caption>
              <thead>
                <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                  <th scope="col" className="border border-gray-200 px-3 py-2">
                    Subject
                  </th>
                  <th scope="col" className="border border-gray-200 px-3 py-2 text-right">
                    Score (%)
                  </th>
                  <th scope="col" className="border border-gray-200 px-3 py-2 text-center">
                    Grade
                  </th>
                  <th scope="col" className="border border-gray-200 px-3 py-2 text-center">
                    Points
                  </th>
                  <th scope="col" className="border border-gray-200 px-3 py-2">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr key={subject.subject_id}>
                    <th scope="row" className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-900">
                      {subject.subject_name}
                      {subject.subject_code && (
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          {subject.subject_code}
                        </span>
                      )}
                    </th>
                    <td className="border border-gray-200 px-3 py-2 text-right tabular-nums">
                      {formatNumber(subject.score)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-center">
                      <Badge className={gradeBadgeClass(subject.grade)} title={subject.grade_name}>
                        {subject.grade}
                      </Badge>
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-center tabular-nums">
                      {subject.points ?? '—'}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-600">
                      {subject.grade_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
            No subject marks were recorded for this student in this exam.
          </p>
        )}
      </section>

      <section aria-labelledby="summary" className="mt-8">
        <h2 id="summary" className="mb-3 text-base font-semibold text-gray-900">
          Summary
        </h2>
        <dl className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Total score</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums text-gray-900">
              {formatNumber(summary.total_score)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Mean score</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums text-gray-900">
              {formatNumber(summary.mean_percentage)}%
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Subjects</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums text-gray-900">
              {summary.subjects_count}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Position</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums text-gray-900">
              {summary.position != null ? formatOrdinal(summary.position) : '—'}
              {summary.total_in_class > 0 ? (
                <span className="ml-1 text-sm font-medium text-gray-500">
                  of {summary.total_in_class}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-gray-500">
          Position is based on the whole published exam (all classes sitting it), matching the
          database report function.
        </p>
      </section>

      <footer className="mt-12 border-t border-gray-200 pt-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <div className="h-10 border-b border-gray-400" />
            <p className="mt-2 text-center text-xs text-gray-600">Class teacher&apos;s signature</p>
          </div>
          <div>
            <div className="h-10 border-b border-gray-400" />
            <p className="mt-2 text-center text-xs text-gray-600">
              Principal&apos;s signature &amp; stamp
            </p>
          </div>
        </div>
        <p className="mt-8 text-center text-[11px] text-gray-400">
          Generated by TUSOME Analytics · Data source: published exam results
        </p>
      </footer>
    </article>
  );
}
