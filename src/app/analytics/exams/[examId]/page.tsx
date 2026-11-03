'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ConfirmDialog } from '@/components/overlays';
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
} from '@/components/ui';
import {
  buildChangedMarkEntries,
  examStatusLabel,
  isExamEditable,
  summarizePublishReadiness,
} from '@/lib/analytics/examPipeline';
import { downloadCsv, toCsv } from '@/lib/analytics/csv';
import {
  describeAnalyticsError,
  getExamMarkEntryRoster,
  getExamPipelineOverview,
  getExamPublishReadiness,
  getExamSetupOptions,
  getSubjectPublishStatus,
  publishSubject,
  isAbortError,
  saveExamSubjectMarks,
  setExamLifecycleStatus,
} from '@/lib/analytics/api';
import { isUuid } from '@/lib/analytics/guards';
import type {
  ExamLifecycleStatus,
  ExamMarkEntryRow,
  ExamPipelineRow,
  ExamPublishReadinessRow,
  ExamSetupOptions,
  SubjectPublishStatusRow,
} from '@/lib/analytics/types';

type WorkspaceTab = 'marks' | 'publish';

function decodeParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function ExamWorkspacePage() {
  const params = useParams<{ examId?: string | string[] }>();
  const examId = decodeParam(params?.examId);
  const validExamId = isUuid(examId);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('marks');
  const [confirmDeleteMarks, setConfirmDeleteMarks] = useState(false);
  const [deletingMarks, setDeletingMarks] = useState(false);
  const [exam, setExam] = useState<ExamPipelineRow | null>(null);
  const [setupOptions, setSetupOptions] = useState<ExamSetupOptions>({
    classes: [],
    streams: [],
    subjects: [],
  });
  const [readiness, setReadiness] = useState<ExamPublishReadinessRow[]>([]);
  const [subjectPublishStatus, setSubjectPublishStatus] = useState<SubjectPublishStatusRow[]>([]);
  const [roster, setRoster] = useState<ExamMarkEntryRow[]>([]);

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStreamId, setSelectedStreamId] = useState('');
  const [draftScores, setDraftScores] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [savingMarks, setSavingMarks] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // Load exam metadata, setup options, and publish readiness
  useEffect(() => {
    if (!validExamId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getExamPipelineOverview({ signal: controller.signal }),
      getExamSetupOptions({ signal: controller.signal }),
      getExamPublishReadiness(examId, { signal: controller.signal }),
      getSubjectPublishStatus(examId, { signal: controller.signal }),
    ])
      .then(([allExams, options, readinessRows, publishRows]) => {
        if (!active) return;
        const found = allExams.find((e) => e.exam_id === examId) ?? null;
        setExam(found);
        setSetupOptions(options);
        setReadiness(readinessRows);
        setSubjectPublishStatus(publishRows);
        if (!selectedSubjectId && options.subjects.length > 0) {
          setSelectedSubjectId(options.subjects[0].id);
        }
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load exam workspace');
        setError(describeAnalyticsError(caught, 'Could not load exam workspace.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [examId, validExamId, reloadToken, selectedSubjectId]);

  // Load mark entry roster when subject / class / stream changes
  useEffect(() => {
    if (!validExamId || !selectedSubjectId) {
      setRoster([]);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setRosterLoading(true);

    getExamMarkEntryRoster(
      examId,
      selectedSubjectId,
      selectedClassId || undefined,
      selectedStreamId || undefined,
      { signal: controller.signal }
    )
      .then((rows) => {
        if (!active) return;
        setRoster(rows);
        const initialDraft: Record<string, string> = {};
        for (const r of rows) {
          initialDraft[r.student_id] = r.score === null ? '' : String(r.score);
        }
        setDraftScores(initialDraft);
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        setActionError(describeAnalyticsError(caught, 'Could not load mark entry roster.'));
      })
      .finally(() => {
        if (active) setRosterLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [examId, validExamId, selectedSubjectId, selectedClassId, selectedStreamId, reloadToken]);

  const refresh = useCallback(() => {
    setActionError(null);
    setActionSuccess(null);
    setReloadToken((v) => v + 1);
  }, []);

  const readinessSummary = useMemo(
    () => summarizePublishReadiness(readiness),
    [readiness]
  );

  const visibleStreams = useMemo(
    () =>
      selectedClassId
        ? setupOptions.streams.filter((s) => s.class_id === selectedClassId)
        : setupOptions.streams,
    [setupOptions.streams, selectedClassId]
  );

  const draftValidation = useMemo(
    () => buildChangedMarkEntries(roster, draftScores),
    [roster, draftScores]
  );

  const studentsWithMarksInRoster = useMemo(
    () => roster.filter((r) => r.score !== null).length,
    [roster]
  );

  const handleSaveMarks = async (event: React.FormEvent) => {
    event.preventDefault();
    if (draftValidation.invalidStudentIds.length > 0) {
      setActionError('Scores must be numbers between 0 and 100.');
      return;
    }
    if (draftValidation.entries.length === 0) return;

    setSavingMarks(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const savedCount = await saveExamSubjectMarks(
        examId,
        selectedSubjectId,
        draftValidation.entries
      );
      setActionSuccess(
        `Saved ${savedCount} subject mark ${savedCount === 1 ? 'entry' : 'entries'}.`
      );
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save marks.'));
    } finally {
      setSavingMarks(false);
    }
  };

  const handleSetStatus = async (nextStatus: ExamLifecycleStatus) => {
    setUpdatingStatus(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await setExamLifecycleStatus(examId, nextStatus);
      setActionSuccess(
        nextStatus === 'published'
          ? 'Exam published! All Analytics & Printout reports are now live for this exam.'
          : `Exam status changed to ${examStatusLabel(nextStatus)}. Marks are now unlocked for editing.`
      );
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not update exam status.'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (!validExamId) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Invalid exam link">
          The exam identifier in this URL is not a valid UUID.
        </Alert>
      </main>
    );
  }

  const editable = exam ? isExamEditable(exam.status) : false;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">
              Analytics
            </Link>{' '}
            /{' '}
            <Link href="/analytics/exams" className="text-blue-700 hover:underline">
              Exams &amp; marks
            </Link>{' '}
            / {exam?.name ?? 'Exam workspace'}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {exam?.name ?? 'Exam Workspace'}
            </h1>
            {exam && (
              <Badge
                className={
                  exam.status === 'published'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }
              >
                {examStatusLabel(exam.status)}
              </Badge>
            )}
          </div>
          {exam && (
            <p className="mt-1 text-sm text-gray-600">
              {[exam.term, exam.academic_year, exam.class_names.join(', ')]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exam &&
            (exam.status === 'published' ? (
              <Button
                variant="secondary"
                disabled={updatingStatus}
                onClick={() => handleSetStatus('reopened')}
              >
                {updatingStatus ? 'Updating…' : 'Reopen Exam for Edits'}
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={updatingStatus || !readinessSummary.canPublish}
                onClick={() => handleSetStatus('published')}
              >
                {updatingStatus ? 'Publishing…' : 'Publish Exam to Reports'}
              </Button>
            ))}
          <Link
            href="/analytics/exams"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            All exams
          </Link>
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Workspace tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('marks')}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'marks'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          1. Key-in Subject Marks
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('publish')}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'publish'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          2. Publish Readiness &amp; Reports Flow ({readinessSummary.completionPercentage}%)
        </button>
      </div>

      {actionError && (
        <div className="mb-4">
          <Alert tone="error" title="Action failed">
            {actionError}
          </Alert>
        </div>
      )}

      {actionSuccess && (
        <div className="mb-4">
          <Alert tone="success" title="Saved">
            {actionSuccess}
          </Alert>
        </div>
      )}

      {loading ? (
        <LoadingPanel label="Loading exam workspace…" />
      ) : error || !exam ? (
        <Alert
          tone="error"
          title="Could not load exam"
          action={
            <Button variant="danger" size="sm" onClick={refresh}>
              Retry
            </Button>
          }
        >
          {error ?? 'Exam not found.'}
        </Alert>
      ) : activeTab === 'publish' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Mark Completion"
              value={`${readinessSummary.completionPercentage}%`}
              hint={`${readinessSummary.totalRecordedMarks} marks entered`}
            />
            <StatCard
              label="Subjects with Marks"
              value={`${readinessSummary.subjectsWithMarks} / ${readinessSummary.totalSubjects}`}
              hint={`${readinessSummary.completeSubjects} fully complete`}
            />
            <StatCard label="Enrolled Cohort" value={readinessSummary.enrolledStudents} />
            <StatCard label="Current Status" value={examStatusLabel(exam.status)} />
          </div>

          {exam.status === 'published' && (
            <Card>
              <CardHeader
                title="Live reports & printouts for this published exam"
              />
              <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <Link
                  href="/analytics"
                  className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 hover:bg-blue-100/70"
                >
                  <p className="text-sm font-semibold text-blue-900">Analytics Dashboard</p>
                  <p className="mt-1 text-xs text-blue-800">
                    Class ranking, grade distribution &amp; subject breakdown.
                  </p>
                </Link>
                <Link
                  href={`/analytics/merit-list?exam=${encodeURIComponent(exam.exam_id)}`}
                  className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 hover:bg-blue-100/70"
                >
                  <p className="text-sm font-semibold text-blue-900">
                    Merit List &amp; Most Improved
                  </p>
                  <p className="mt-1 text-xs text-blue-800">
                    Ranked cohort and delta against previous published exam.
                  </p>
                </Link>
                <Link
                  href={`/analytics/mark-sheet?exam=${encodeURIComponent(exam.exam_id)}`}
                  className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 hover:bg-blue-100/70"
                >
                  <p className="text-sm font-semibold text-blue-900">Mark Sheet</p>
                  <p className="mt-1 text-xs text-blue-800">
                    Student × subject matrix with grades and points.
                  </p>
                </Link>
                <Link
                  href={`/analytics/analysis?exam=${encodeURIComponent(exam.exam_id)}`}
                  className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 hover:bg-blue-100/70"
                >
                  <p className="text-sm font-semibold text-blue-900">Analysis Report</p>
                  <p className="mt-1 text-xs text-blue-800">
                    Class grade summary, top/bottom performers &amp; subject means.
                  </p>
                </Link>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Subject publish readiness (Zeraki PublishStatusComponent)"
            />
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Subject
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Students with Marks
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Students without Marks
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Subject Mean
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Publish Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {readiness.map((row) => (
                    <tr key={row.subject_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {row.subject_name}{' '}
                        {row.subject_code && (
                          <span className="text-xs text-gray-500">({row.subject_code})</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            row.recorded_marks > 0
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-gray-200 bg-gray-100 text-gray-700'
                          }
                        >
                          {row.recorded_marks} / {row.enrolled_students}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.missing_marks}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.recorded_marks > 0 ? `${row.mean_score}%` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {(subjectPublishStatus.find((s) => s.subject_id === row.subject_id)?.published) ? (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">
                            Published
                          </Badge>
                        ) : (
                          <Badge className="border-gray-300 bg-gray-100 text-gray-700">
                            Unpublished
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubjectId(row.subject_id);
                              setActiveTab('marks');
                            }}
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            {editable ? 'Key in marks' : 'View marks'}
                          </button>
                          {exam.status !== 'published' && row.recorded_marks > 0 && (
                            <button
                              type="button"
                              onClick={async () => {
                                const pubStatus = subjectPublishStatus.find(
                                  (s) => s.subject_id === row.subject_id
                                );
                                const currentlyPublished = pubStatus?.published ?? false;
                                try {
                                  await publishSubject(examId, row.subject_id, !currentlyPublished);
                                  setActionSuccess(
                                    currentlyPublished
                                      ? `Unpublished ${row.subject_name}.`
                                      : `Published ${row.subject_name} results.`
                                  );
                                  setReloadToken((v) => v + 1);
                                } catch (caught) {
                                  setActionError(
                                    describeAnalyticsError(caught, 'Could not update subject publish status.')
                                  );
                                }
                              }}
                              className={`text-xs font-semibold ${
                                (subjectPublishStatus.find((s) => s.subject_id === row.subject_id)?.published)
                                  ? 'text-amber-700 hover:text-amber-900'
                                  : 'text-emerald-700 hover:text-emerald-900'
                              }`}
                            >
                              {(subjectPublishStatus.find((s) => s.subject_id === row.subject_id)?.published)
                                ? 'Unpublish'
                                : 'Publish'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {!editable && (
            <Alert
              tone="info"
              title="This exam is published (read-only)"
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={updatingStatus}
                  onClick={() => handleSetStatus('reopened')}
                >
                  Reopen to edit marks
                </Button>
              }
            >
              Published exams are locked by the database trigger{' '}
              <code>marks_editable_guard</code> so live report cards and merit lists cannot drift.
              Reopen the exam if you need to add or correct marks.
            </Alert>
          )}

          <Card>
            {editable && (
              <div className="border-b border-gray-100 bg-gray-50/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs font-medium text-gray-700">
                    Bulk upload marks (CSV):
                  </label>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const text = await file.text();
                      const lines = text.trim().split(/\r?\n/);
                      if (lines.length < 2) {
                        setActionError('CSV file must have a header row and at least one data row.');
                        return;
                      }
                      const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/"/g, ''));
                      const admIdx = header.findIndex((h) => h.includes('admission') || h === 'admno' || h === 'adm_no');
                      const markIdx = header.findIndex((h) => h.includes('mark') || h.includes('score'));
                      if (admIdx === -1 || markIdx === -1) {
                        setActionError('CSV must have "Admission No" and "Marks" columns.');
                        return;
                      }
                      const entries: { student_id: string; score: number | null }[] = [];
                      const errors: string[] = [];
                      for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''));
                        const admNo = cols[admIdx];
                        const markStr = cols[markIdx];
                        const student = roster.find((r) => r.admission_no === admNo);
                        if (!student) {
                          errors.push(`Row ${i + 1}: admission no "${admNo}" not found in roster.`);
                          continue;
                        }
                        const score = markStr === '' ? null : Number(markStr);
                        if (markStr !== '' && (isNaN(score!) || score! < 0 || score! > 100)) {
                          errors.push(`Row ${i + 1}: invalid mark "${markStr}".`);
                          continue;
                        }
                        entries.push({ student_id: student.student_id, score });
                      }
                      if (errors.length > 0) {
                        setActionError(errors.slice(0, 5).join(' '));
                        return;
                      }
                      if (entries.length === 0) {
                        setActionError('No valid entries found in CSV.');
                        return;
                      }
                      try {
                        const saved = await saveExamSubjectMarks(examId, selectedSubjectId, entries);
                        setActionSuccess(`Uploaded ${saved} mark entries from CSV.`);
                        setReloadToken((v) => v + 1);
                      } catch (caught) {
                        setActionError(describeAnalyticsError(caught, 'Could not upload marks.'));
                      }
                    }}
                    className="text-xs"
                  />
                  <span className="text-xs text-gray-500">
                    CSV with columns: Admission No, Marks
                  </span>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3 p-4">
              <SelectField
                id="mark-entry-subject"
                label="Subject"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
              >
                {setupOptions.subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} {sub.code ? `(${sub.code})` : ''}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="mark-entry-class"
                label="Class"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedStreamId('');
                }}
              >
                <option value="">All exam classes</option>
                {setupOptions.classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="mark-entry-stream"
                label="Stream"
                value={selectedStreamId}
                onChange={(e) => setSelectedStreamId(e.target.value)}
              >
                <option value="">All streams</option>
                {visibleStreams.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </SelectField>
            </div>
          </Card>

          <form onSubmit={handleSaveMarks}>
            <Card>
             <CardHeader title="Student mark entry sheet" />



                action={
                  <div className="flex items-center gap-2">
                    {roster.length > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const csv = toCsv(roster, [
                            { header: 'Admission No', value: (r) => r.admission_no },
                            { header: 'Student Name', value: (r) => r.student_name },
                            { header: 'Class', value: (r) => r.class_name },
                            { header: 'Stream', value: (r) => r.stream_name },
                            { header: 'Marks', value: (r) => r.score },
                            { header: 'Grade', value: (r) => r.grade_code },
                            { header: 'Points', value: (r) => r.points },
                          ]);
                          downloadCsv(
                            `marks-${selectedSubjectId}-${examId}`,
                            csv
                          );
                        }}
                      >
                        Download Marks
                      </Button>
                    )}
                    {editable && roster.length > 0 && (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfirmDeleteMarks(true)}
                        >
                          Delete All Marks
                        </Button>
                        <ConfirmDialog
                          open={confirmDeleteMarks}
                          title="Delete all marks for this subject?"
                          confirmLabel="Delete all marks"
                          busy={deletingMarks}
                          onCancel={() => setConfirmDeleteMarks(false)}
                          onConfirm={async () => {
                            setDeletingMarks(true);
                            try {
                              const entries = roster.map((r) => ({
                                student_id: r.student_id,
                                score: null,
                              }));
                              await saveExamSubjectMarks(examId, selectedSubjectId, entries);
                              setActionSuccess('All marks deleted for this subject.');
                              setReloadToken((v) => v + 1);
                            } catch (caught) {
                              setActionError(
                                describeAnalyticsError(caught, 'Could not delete marks.')
                              );
                            } finally {
                              setDeletingMarks(false);
                              setConfirmDeleteMarks(false);
                            }
                          }}
                        />
                      </>
                    )}
                    {editable && (
                      <>
                        {draftValidation.entries.length > 0 && (
                          <span className="text-xs font-medium text-amber-800">
                            {draftValidation.entries.length} unsaved{' '}
                            {draftValidation.entries.length === 1 ? 'change' : 'changes'}
                          </span>
                        )}
                        <Button
                          type="submit"
                          disabled={
                            savingMarks ||
                            draftValidation.entries.length === 0 ||
                            draftValidation.invalidStudentIds.length > 0
                          }
                        >
                          {savingMarks ? 'Saving…' : 'Save subject marks'}
                        </Button>
                      </>
                    )}
                  </div>
                }

              {rosterLoading ? (
                <div className="p-6">
                  <LoadingPanel label="Loading student roster…" />
                </div>
              ) : roster.length === 0 ? (
                <EmptyState
                  title="No students on this roster"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                      <tr>
                        <th scope="col" className="px-4 py-3">
                          Admission No
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Student Name
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Class / Stream
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Marks (0–100)
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Configured Grade
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Report Card
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {roster.map((row) => {
                        const rawVal = draftScores[row.student_id] ?? '';
                        const isInvalid = draftValidation.invalidStudentIds.includes(
                          row.student_id
                        );
                        return (
                          <tr key={row.student_id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                              {row.admission_no}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-gray-900">
                              {row.student_name}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">
                              {[row.class_name, row.stream_name].filter(Boolean).join(' · ') ||
                                '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                max={100}
                                disabled={!editable}
                                aria-label={`Marks for ${row.student_name}`}
                                value={rawVal}
                                onChange={(e) =>
                                  setDraftScores((prev) => ({
                                    ...prev,
                                    [row.student_id]: e.target.value,
                                  }))
                                }
                                placeholder="—"
                                className={`w-28 rounded-lg border px-2.5 py-1 text-sm ${
                                  isInvalid
                                    ? 'border-red-500 bg-red-50'
                                    : 'border-gray-300 bg-white'
                                } disabled:bg-gray-100 disabled:text-gray-500`}
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              {row.grade_code ? (
                                <Badge className="border-blue-200 bg-blue-50 text-blue-800">
                                  {row.grade_code}{' '}
                                  {row.points !== null ? `(${row.points} pts)` : ''}
                                </Badge>
                              ) : (
                                <span className="text-xs text-gray-400">No mark</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs">
                              {exam.status === 'published' && row.score !== null ? (
                                <Link
                                  href={`/analytics/report/${encodeURIComponent(
                                    row.student_id
                                  )}?exam=${encodeURIComponent(exam.exam_id)}`}
                                  className="font-medium text-blue-700 hover:underline"
                                >
                                  Report card
                                </Link>
                              ) : (
                                <span className="text-gray-400">
                                  {exam.status === 'published' ? 'No marks' : 'Publish to view'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </form>
        </div>
      )}
    </main>
  );
}
