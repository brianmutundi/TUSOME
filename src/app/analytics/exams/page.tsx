'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingPanel,
  SelectField,
  StatCard,
  TextField,
} from '@/components/ui';
import {
  ASSESSMENT_COMPONENT_OPTIONS,
  computeExamPipelineStats,
  EXAM_TERM_OPTIONS,
  examStatusLabel,
  filterExamPipeline,
} from '@/lib/analytics/examPipeline';
import {
  createExam,
  describeAnalyticsError,
  getExamPipelineOverview,
  getExamSetupOptions,
  isAbortError,
  setExamLifecycleStatus,
} from '@/lib/analytics/api';
import type {
  AssessmentComponentCode,
  ExamLifecycleStatus,
  ExamPipelineRow,
  ExamSetupOptions,
} from '@/lib/analytics/types';

function statusBadgeClass(status: ExamLifecycleStatus): string {
  switch (status) {
    case 'published':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'reopened':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'review':
      return 'border-indigo-200 bg-indigo-50 text-indigo-800';
    case 'draft':
    default:
      return 'border-gray-300 bg-gray-100 text-gray-800';
  }
}

export default function ExamsPipelinePage() {
  const [exams, setExams] = useState<ExamPipelineRow[]>([]);
  const [setupOptions, setSetupOptions] = useState<ExamSetupOptions>({
    classes: [],
    streams: [],
    subjects: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Filters
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ExamLifecycleStatus>('all');
  const [yearFilter, setYearFilter] = useState('all');

  // Create exam form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTerm, setNewTerm] = useState<string>('Term 1');
  const [newYear, setNewYear] = useState<string>('2026');
  const [newComponent, setNewComponent] = useState<AssessmentComponentCode>('end_term');
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [busyExamId, setBusyExamId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getExamPipelineOverview({ signal: controller.signal }),
      getExamSetupOptions({ signal: controller.signal }),
    ])
      .then(([examRows, options]) => {
        if (!active) return;
        setExams(examRows);
        setSetupOptions(options);
        if (options.classes.length > 0 && selectedClassIds.size === 0) {
          setSelectedClassIds(new Set(options.classes.map((c) => c.id)));
        }
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load exam pipeline');
        setError(describeAnalyticsError(caught, 'Could not load exams pipeline.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken, selectedClassIds.size]);

  const refresh = useCallback(() => {
    setActionError(null);
    setActionSuccess(null);
    setReloadToken((v) => v + 1);
  }, []);

  const stats = useMemo(() => computeExamPipelineStats(exams), [exams]);
  const years = useMemo(() => {
    const set = new Set<string>();
    for (const row of exams) {
      if (row.academic_year !== null) set.add(String(row.academic_year));
    }
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [exams]);

  const filteredExams = useMemo(
    () =>
      filterExamPipeline(exams, {
        query,
        status: statusFilter,
        academicYear: yearFilter,
      }),
    [exams, query, statusFilter, yearFilter]
  );

  const toggleClassId = (classId: string, checked: boolean) => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(classId);
      else next.delete(classId);
      return next;
    });
  };

  const handleCreateExam = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createExam({
        name: newName,
        term: newTerm,
        academicYear: Number(newYear),
        assessmentComponent: newComponent,
        classIds: Array.from(selectedClassIds),
      });
      setNewName('');
      setShowCreateForm(false);
      setActionSuccess(
        'Created draft exam. Open "Enter Marks / Publish" on the exam row to key in subject marks and publish.'
      );
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create exam.'));
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (exam: ExamPipelineRow, nextStatus: ExamLifecycleStatus) => {
    setBusyExamId(exam.exam_id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await setExamLifecycleStatus(exam.exam_id, nextStatus);
      setActionSuccess(
        nextStatus === 'published'
          ? `Published "${exam.name}". It is now live across the Analytics Dashboard, Merit List, Mark Sheet, Analysis Report, Report Cards, and Transcripts.`
          : `Changed "${exam.name}" status to ${examStatusLabel(nextStatus)}. Marks can now be edited.`
      );
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not change exam status.'));
    } finally {
      setBusyExamId(null);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">
              Analytics
            </Link>{' '}
            / Exams, marks &amp; publishing
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            Exams &amp; Marks Pipeline
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Create exams, enter subject marks per class/stream, verify publish readiness, and
            publish results into school reports and printouts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => setShowCreateForm((v) => !v)}>
            {showCreateForm ? 'Close form' : '+ Create exam'}
          </Button>
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Zeraki 4-stage pipeline overview */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-3 p-4 text-xs sm:grid-cols-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="font-semibold text-gray-900">1. Create Exam (Draft)</p>
            <p className="mt-1 text-gray-600">
              Define exam name, term, academic year, type, and participating classes (
              <code>exam_classes</code>).
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="font-semibold text-gray-900">2. Key-in Subject Marks</p>
            <p className="mt-1 text-gray-600">
              Teachers enter 0–100 marks per subject and class while the exam is in{' '}
              <code>draft</code> or <code>reopened</code> status.
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="font-semibold text-gray-900">3. Readiness &amp; Publish</p>
            <p className="mt-1 text-gray-600">
              Review subject completion, verify active grading bands, and publish. Publishing locks
              marks via <code>marks_editable_guard</code>.
            </p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <p className="font-semibold text-blue-950">4. Reports &amp; Printouts</p>
            <p className="mt-1 text-blue-900">
              Published exams immediately flow into Dashboard, Merit List, Mark Sheet, Analysis,
              Report Cards, and Transcripts.
            </p>
          </div>
        </div>
      </Card>

      {actionError && (
        <div className="mb-4">
          <Alert tone="error" title="Action failed">
            {actionError}
          </Alert>
        </div>
      )}

      {actionSuccess && (
        <div className="mb-4">
          <Alert tone="success" title="Updated">
            {actionSuccess}
          </Alert>
        </div>
      )}

      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader
            title="Create new exam"
            description="Starts in Draft status so subject marks can be entered before publishing to reports"
          />
          <form onSubmit={handleCreateExam} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField
                id="create-exam-name"
                label="Exam name"
                required
                placeholder="e.g. Term 2 End-Term 2026"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <SelectField
                id="create-exam-term"
                label="Term"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
              >
                {EXAM_TERM_OPTIONS.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </SelectField>
              <TextField
                id="create-exam-year"
                label="Academic year"
                type="number"
                min={2000}
                max={2100}
                required
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
              />
              <SelectField
                id="create-exam-component"
                label="Exam type"
                value={newComponent}
                onChange={(e) => setNewComponent(e.target.value as AssessmentComponentCode)}
              >
                {ASSESSMENT_COMPONENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SelectField>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Classes sitting for this exam ({selectedClassIds.size} selected)
              </p>
              {setupOptions.classes.length === 0 ? (
                <p className="text-xs text-gray-500">No classes found in your school.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {setupOptions.classes.map((cls) => (
                    <label
                      key={cls.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={selectedClassIds.has(cls.id)}
                        onChange={(e) => toggleClassId(cls.id, e.target.checked)}
                      />
                      <span>{cls.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || selectedClassIds.size === 0}>
                {creating ? 'Creating…' : 'Create draft exam'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <LoadingPanel label="Loading exams pipeline…" />
      ) : error ? (
        <Alert
          tone="error"
          title="Could not load exams"
          action={
            <Button variant="danger" size="sm" onClick={refresh}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total exams" value={stats.total} />
            <StatCard
              label="Published (Live in Reports)"
              value={stats.published}
              hint="Visible on Dashboard & Printouts"
            />
            <StatCard
              label="Draft / Reopened"
              value={stats.editable}
              hint="Open for teacher mark entry"
            />
            <StatCard label="Total marks recorded" value={stats.totalMarksEntered} />
          </div>

          <Card>
            <div className="flex flex-wrap items-end gap-3 p-4">
              <TextField
                id="exam-pipeline-search"
                label="Search"
                type="search"
                placeholder="Search exam name, term or class…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <SelectField
                id="exam-pipeline-status"
                label="Lifecycle status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | ExamLifecycleStatus)
                }
              >
                <option value="all">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="reopened">Reopened</option>
                <option value="review">In Review</option>
              </SelectField>
              <SelectField
                id="exam-pipeline-year"
                label="Academic year"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              >
                <option value="all">All years</option>
                {years.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </SelectField>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="School exams"
              description={`${filteredExams.length} of ${exams.length} exams shown`}
            />
            {filteredExams.length === 0 ? (
              <EmptyState
                title="No exams match this view"
                description="Create a new exam above or clear the filters."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Exam
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Classes
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Mark Coverage
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Actions &amp; Reports Flow
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredExams.map((exam) => {
                      const isBusy = busyExamId === exam.exam_id;
                      const isPublished = exam.status === 'published';
                      return (
                        <tr key={exam.exam_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link
                              href={`/analytics/exams/${encodeURIComponent(exam.exam_id)}`}
                              className="font-semibold text-blue-800 hover:underline"
                            >
                              {exam.name}
                            </Link>
                            <div className="text-xs text-gray-500">
                              {[exam.term, exam.academic_year, exam.assessment_component]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-700">
                            {exam.class_names.length > 0
                              ? exam.class_names.join(', ')
                              : 'All classes'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={statusBadgeClass(exam.status)}>
                              {examStatusLabel(exam.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-700">
                            <div>
                              <strong>{exam.students_with_marks}</strong> / {exam.enrolled_students}{' '}
                              students
                            </div>
                            <div className="text-gray-500">
                              {exam.subjects_with_marks} subjects · {exam.total_marks_entered} marks
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex flex-wrap items-center justify-end gap-2 text-xs">
                              <Link
                                href={`/analytics/exams/${encodeURIComponent(exam.exam_id)}`}
                                className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-800 hover:bg-blue-100"
                              >
                                {isPublished ? 'Readiness & Reports' : 'Enter Marks / Publish'}
                              </Link>
                              {isPublished ? (
                                <>
                                  <Link
                                    href={`/analytics/merit-list?exam=${encodeURIComponent(exam.exam_id)}`}
                                    className="font-medium text-blue-700 hover:underline"
                                  >
                                    Merit List
                                  </Link>
                                  <Link
                                    href={`/analytics/mark-sheet?exam=${encodeURIComponent(exam.exam_id)}`}
                                    className="font-medium text-blue-700 hover:underline"
                                  >
                                    Mark Sheet
                                  </Link>
                                  <Link
                                    href={`/analytics/analysis?exam=${encodeURIComponent(exam.exam_id)}`}
                                    className="font-medium text-blue-700 hover:underline"
                                  >
                                    Analysis
                                  </Link>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleStatusChange(exam, 'reopened')}
                                    className="font-medium text-amber-700 hover:text-amber-900 disabled:opacity-50"
                                  >
                                    Reopen
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy || exam.total_marks_entered === 0}
                                  title={
                                    exam.total_marks_entered === 0
                                      ? 'Enter at least one mark before publishing'
                                      : 'Publish exam into reports'
                                  }
                                  onClick={() => handleStatusChange(exam, 'published')}
                                  className="font-semibold text-emerald-700 hover:text-emerald-900 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Publish
                                </button>
                              )}
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
        </div>
      )}
    </main>
  );
}
