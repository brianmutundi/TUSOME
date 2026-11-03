import type {
  AssessmentComponentCode,
  ExamLifecycleStatus,
  ExamMarkEntryRow,
  ExamPipelineRow,
  ExamPublishReadinessRow,
} from './types';

/**
 * Pure helpers for the Zeraki-style Exam -> Marks -> Publish -> Reports flow.
 *
 * Grounded in the extracted Zeraki web bundle:
 * - `chunk-HTDCN6NT.js`: `CreateExamComponent` (name, term, year, exam type,
 *   forms/classes sitting the exam).
 * - `chunk-AMVB26KM.js`: `UploadExamsSubjectComponent` (key in marks per
 *   student, count of students with/without results).
 * - `chunk-372RFQAZ.js` & `chunk-RMCHKSBZ.js`: `ManageExamComponent` &
 *   `PublishStatusComponent` (per-subject completion status, publish results,
 *   unpublish/reopen results, analyze results).
 */

export const EXAM_TERM_OPTIONS = ['Term 1', 'Term 2', 'Term 3'] as const;

export const ASSESSMENT_COMPONENT_OPTIONS: ReadonlyArray<{
  value: AssessmentComponentCode;
  label: string;
}> = [
  { value: 'test_exam', label: 'CAT / Written Test' },
  { value: 'mid_term', label: 'Mid-Term Exam' },
  { value: 'end_term', label: 'End-Term Exam' },
  { value: 'annual', label: 'Annual / Consolidated Exam' },
];

export function examStatusLabel(status: ExamLifecycleStatus): string {
  switch (status) {
    case 'published':
      return 'Published';
    case 'reopened':
      return 'Reopened (Editable)';
    case 'review':
      return 'In Review';
    case 'draft':
    default:
      return 'Draft';
  }
}

export function isExamEditable(status: ExamLifecycleStatus): boolean {
  return status !== 'published';
}

export interface ExamPipelineStats {
  total: number;
  published: number;
  editable: number;
  totalMarksEntered: number;
}

export function computeExamPipelineStats(rows: ExamPipelineRow[]): ExamPipelineStats {
  let published = 0;
  let editable = 0;
  let totalMarksEntered = 0;

  for (const row of rows) {
    if (row.status === 'published') published += 1;
    else editable += 1;
    totalMarksEntered += row.total_marks_entered;
  }

  return {
    total: rows.length,
    published,
    editable,
    totalMarksEntered,
  };
}

export interface ExamPipelineFilterCriteria {
  query?: string;
  status?: 'all' | ExamLifecycleStatus;
  academicYear?: string;
}

export function filterExamPipeline(
  rows: ExamPipelineRow[],
  criteria: ExamPipelineFilterCriteria = {}
): ExamPipelineRow[] {
  const query = (criteria.query ?? '').trim().toLowerCase();
  const status = criteria.status ?? 'all';
  const year = (criteria.academicYear ?? '').trim();

  return rows.filter((row) => {
    if (status !== 'all' && row.status !== status) return false;
    if (year && year !== 'all' && String(row.academic_year ?? '') !== year) return false;
    if (!query) return true;

    const name = row.name.toLowerCase();
    const term = (row.term ?? '').toLowerCase();
    const classes = row.class_names.join(' ').toLowerCase();
    return name.includes(query) || term.includes(query) || classes.includes(query);
  });
}

export interface PublishReadinessSummary {
  totalSubjects: number;
  subjectsWithMarks: number;
  completeSubjects: number;
  enrolledStudents: number;
  totalRecordedMarks: number;
  completionPercentage: number;
  canPublish: boolean;
}

export function summarizePublishReadiness(
  rows: ExamPublishReadinessRow[]
): PublishReadinessSummary {
  const totalSubjects = rows.length;
  const enrolledStudents = rows[0]?.enrolled_students ?? 0;
  let subjectsWithMarks = 0;
  let completeSubjects = 0;
  let totalRecordedMarks = 0;

  for (const row of rows) {
    if (row.recorded_marks > 0) subjectsWithMarks += 1;
    if (row.enrolled_students > 0 && row.missing_marks === 0) completeSubjects += 1;
    totalRecordedMarks += row.recorded_marks;
  }

  const expectedTotal = totalSubjects * enrolledStudents;
  const completionPercentage =
    expectedTotal > 0 ? Math.round((totalRecordedMarks / expectedTotal) * 10000) / 100 : 0;

  return {
    totalSubjects,
    subjectsWithMarks,
    completeSubjects,
    enrolledStudents,
    totalRecordedMarks,
    completionPercentage,
    canPublish: totalRecordedMarks > 0,
  };
}

export interface MarkDraftValidationResult {
  entries: Array<{ student_id: string; score: number | null }>;
  invalidStudentIds: string[];
}

/**
 * Compare a map of draft score strings (`studentId -> rawInput`) against the
 * loaded `ExamMarkEntryRow[]` roster, returning only changed rows and flagging
 * any out-of-range (`< 0` or `> 100`) or non-numeric inputs.
 */
export function buildChangedMarkEntries(
  roster: ExamMarkEntryRow[],
  draftScores: Record<string, string>
): MarkDraftValidationResult {
  const entries: Array<{ student_id: string; score: number | null }> = [];
  const invalidStudentIds: string[] = [];

  for (const row of roster) {
    if (!(row.student_id in draftScores)) continue;
    const raw = draftScores[row.student_id].trim();

    if (raw === '') {
      if (row.score !== null) {
        entries.push({ student_id: row.student_id, score: null });
      }
      continue;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      invalidStudentIds.push(row.student_id);
      continue;
    }

    const rounded = Math.round(parsed * 100) / 100;
    if (row.score !== rounded) {
      entries.push({ student_id: row.student_id, score: rounded });
    }
  }

  return { entries, invalidStudentIds };
}
