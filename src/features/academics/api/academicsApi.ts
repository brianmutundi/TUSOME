/** academics API — Supabase RPC calls for the academics feature. */

import { throwIfAborted } from '../../../shared/api/request';
import { textOrNull } from '../../../shared/utils/text';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { AnalyticsContractError, normalizeAttendance, normalizeClassPerformance, normalizeClasses, normalizeExamMarkEntryRoster, normalizeExamPipelineOverview, normalizeExamPublishReadiness, normalizeExamSetupOptions, normalizeExams, normalizeGradeDistribution, normalizeMarkSheet, normalizeMostImproved, normalizePathways, normalizeReportTemplateConfig, normalizeStreams, normalizeStudentExamHistory, normalizeStudentReport, normalizeSubjectPapers, normalizeSubjectPerformance, normalizeSubjectPublishStatus, normalizeTermDates } from '@/lib/analytics/guards';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { AssessmentComponentCode, AttendanceRow, ClassOption, ClassPerformanceStudent, ClassWithStreams, CommentCategory, CurriculumCoverage, CurriculumCoverageSummary, ExamComment, ExamLifecycleStatus, ExamMarkEntryRow, ExamOption, ExamPipelineRow, ExamPublishReadinessRow, ExamSetupOptions, GradeDistribution, LessonPlan, MarkSheetRow, MostImprovedRow, Pathway, ReportTemplateConfig, StreamOption, StudentExamHistoryRow, StudentReportData, SubjectPaper, SubjectPerformance, SubjectPublishStatusRow, SubjectWithDetails, TermDateRow, TimetableEntry } from '@/lib/analytics/types';

export async function getClassPerformance(
  examId: string,
  classId?: string,
  streamId?: string,
  options: RequestOptions = {}
): Promise<ClassPerformanceStudent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_class_performance', {
      p_exam_id: examId,
      p_class_id: classId || null,
      p_stream_id: streamId || null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeClassPerformance(data);
}

export async function getGradeDistribution(
  examId: string,
  classId?: string,
  streamId?: string,
  options: RequestOptions = {}
): Promise<GradeDistribution[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_grade_distribution', {
      p_exam_id: examId,
      p_class_id: classId || null,
      p_stream_id: streamId || null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeGradeDistribution(data);
}

export async function getSubjectPerformance(
  examId: string,
  classId?: string,
  streamId?: string,
  options: RequestOptions = {}
): Promise<SubjectPerformance[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_subject_performance', {
      p_exam_id: examId,
      p_class_id: classId || null,
      p_stream_id: streamId || null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeSubjectPerformance(data);
}

export async function getStudentReportData(
  studentId: string,
  examId: string,
  options: RequestOptions = {}
): Promise<StudentReportData> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_report_data', {
      p_student_id: studentId,
      p_exam_id: examId,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeStudentReport(data);
}

export interface AnalyticsFilterOptions {
  exams: ExamOption[];
  classes: ClassOption[];
  streams: StreamOption[];
}

export async function getAnalyticsFilters(
  options: RequestOptions = {}
): Promise<AnalyticsFilterOptions> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_analytics_filters')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new AnalyticsContractError('filters');
  }
  const payload = data as Record<string, unknown>;
  return {
    exams: normalizeExams(payload.exams),
    classes: normalizeClasses(payload.classes),
    streams: normalizeStreams(payload.streams),
  };
}

export async function getMarkSheet(
  examId: string,
  classId?: string,
  streamId?: string,
  options: RequestOptions = {}
): Promise<MarkSheetRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_mark_sheet', {
      p_exam_id: examId,
      p_class_id: classId || null,
      p_stream_id: streamId || null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeMarkSheet(data);
}

export async function getStudentExamHistory(
  studentId: string,
  options: RequestOptions = {}
): Promise<StudentExamHistoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_exam_history', {
      p_student_id: studentId,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeStudentExamHistory(data);
}

export async function getMostImproved(
  examId: string,
  classId?: string,
  streamId?: string,
  options: RequestOptions = {}
): Promise<MostImprovedRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_most_improved', {
      p_exam_id: examId,
      p_class_id: classId || null,
      p_stream_id: streamId || null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeMostImproved(data);
}

export async function createReportShareToken(studentId: string, examId: string, options: RequestOptions = {}): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_report_share_token', { p_student_id: studentId, p_exam_id: examId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) throw new AnalyticsContractError('create_report_share_token');
  return data;
}

/** A class and subject the signed-in staff member may set homework for. */
export interface HomeworkScope {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
}

export interface HomeworkItem {
  assignmentId: string;
  classId: string;
  className: string;
  streamId: string | null;
  streamName: string | null;
  subjectId: string;
  subjectName: string;
  title: string;
  instructions: string | null;
  dueDate: string;
  isPublished: boolean;
  createdByName: string | null;
  /** Children currently in the class (or stream). */
  studentCount: number;
  /** Parents who ticked it. A self-report, not a result. */
  doneCount: number;
}

export async function getHomeworkScopes(options: RequestOptions = {}): Promise<HomeworkScope[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_homework_scopes')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
    classId: String(r.class_id),
    className: String(r.class_name ?? ''),
    subjectId: String(r.subject_id),
    subjectName: String(r.subject_name ?? ''),
  }));
}

export async function listHomework(options: RequestOptions = {}): Promise<HomeworkItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('list_homework', { p_from: null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
    assignmentId: String(r.assignment_id),
    classId: String(r.class_id),
    className: String(r.class_name ?? ''),
    streamId: textOrNull(r.stream_id),
    streamName: textOrNull(r.stream_name),
    subjectId: String(r.subject_id),
    subjectName: String(r.subject_name ?? ''),
    title: String(r.title ?? ''),
    instructions: textOrNull(r.instructions),
    dueDate: String(r.due_date ?? '').slice(0, 10),
    isPublished: r.is_published === true,
    createdByName: textOrNull(r.created_by_name),
    studentCount: Number(r.student_count ?? 0),
    doneCount: Number(r.done_count ?? 0),
  }));
}

export interface HomeworkInput {
  title: string;
  instructions: string;
  /** "YYYY-MM-DD" */
  dueDate: string;
  publish: boolean;
}

export async function createHomework(
  scope: { classId: string; streamId: string | null; subjectId: string },
  input: HomeworkInput
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('create_homework', {
    p_class_id: scope.classId,
    p_stream_id: scope.streamId,
    p_subject_id: scope.subjectId,
    p_title: input.title,
    p_instructions: input.instructions,
    p_due_date: input.dueDate,
    p_publish: input.publish,
  });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  return String(data);
}

export async function updateHomework(assignmentId: string, input: HomeworkInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('update_homework', {
    p_assignment_id: assignmentId,
    p_title: input.title,
    p_instructions: input.instructions,
    p_due_date: input.dueDate,
    p_publish: input.publish,
  });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
}

export async function deleteHomework(assignmentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('delete_homework', { p_assignment_id: assignmentId });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
}

export async function getExamSetupOptions(
  options: RequestOptions = {}
): Promise<ExamSetupOptions> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_exam_setup_options')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeExamSetupOptions(data);
}

export async function getExamPipelineOverview(
  options: RequestOptions = {}
): Promise<ExamPipelineRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_exam_pipeline_overview')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeExamPipelineOverview(data);
}

export interface CreateExamInput {
  name: string;
  term: string;
  academicYear: number;
  assessmentComponent: AssessmentComponentCode;
  classIds: string[];
}

export async function createExam(
  input: CreateExamInput,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_exam', {
      p_name: input.name,
      p_term: input.term,
      p_academic_year: input.academicYear,
      p_assessment_component: input.assessmentComponent,
      p_class_ids: input.classIds,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) {
    throw new AnalyticsContractError('create_exam');
  }
  return data;
}

export async function getExamMarkEntryRoster(
  examId: string,
  subjectId: string,
  classId?: string,
  streamId?: string,
  options: RequestOptions = {}
): Promise<ExamMarkEntryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_exam_mark_entry_roster', {
      p_exam_id: examId,
      p_subject_id: subjectId,
      p_class_id: classId || null,
      p_stream_id: streamId || null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeExamMarkEntryRoster(data);
}

export interface MarkEntrySubmissionItem {
  student_id: string;
  score: number | null;
}

export async function saveExamSubjectMarks(
  examId: string,
  subjectId: string,
  entries: MarkEntrySubmissionItem[],
  options: RequestOptions = {}
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('save_exam_subject_marks', {
      p_exam_id: examId,
      p_subject_id: subjectId,
      p_entries: entries,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'number') {
    throw new AnalyticsContractError('save_exam_subject_marks');
  }
  return data;
}

export async function getExamPublishReadiness(
  examId: string,
  options: RequestOptions = {}
): Promise<ExamPublishReadinessRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_exam_publish_readiness', { p_exam_id: examId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeExamPublishReadiness(data);
}

export async function getSubjectPublishStatus(
  examId: string,
  options: RequestOptions = {}
): Promise<SubjectPublishStatusRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_subject_publish_status', { p_exam_id: examId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeSubjectPublishStatus(data);
}

export async function publishSubject(
  examId: string,
  subjectId: string,
  published: boolean,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('publish_subject', {
      p_exam_id: examId,
      p_subject_id: subjectId,
      p_published: published,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function grantSubjectTeacherAccess(
  examId: string,
  subjectId: string,
  teacherId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('grant_subject_teacher_access', {
      p_exam_id: examId,
      p_subject_id: subjectId,
      p_teacher_id: teacherId,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function revokeSubjectTeacherAccess(
  examId: string,
  subjectId: string,
  teacherId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('revoke_subject_teacher_access', {
      p_exam_id: examId,
      p_subject_id: subjectId,
      p_teacher_id: teacherId,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function setExamLifecycleStatus(
  examId: string,
  status: ExamLifecycleStatus,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('set_exam_lifecycle_status', {
      p_exam_id: examId,
      p_status: status,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getTermDates(
  academicYear?: number,
  term?: string,
  options: RequestOptions = {}
): Promise<TermDateRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_term_dates', {
      p_academic_year: academicYear ?? null,
      p_term: term ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeTermDates(data);
}

export async function upsertTermDate(
  academicYear: number,
  term: string,
  openingDate: string,
  closingDate: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_term_date', {
      p_academic_year: academicYear,
      p_term: term,
      p_opening_date: openingDate,
      p_closing_date: closingDate,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) {
    throw new AnalyticsContractError('upsert_term_date');
  }
  return data;
}

export async function getReportTemplateConfig(
  options: RequestOptions = {}
): Promise<ReportTemplateConfig[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_report_template_config')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeReportTemplateConfig(data);
}

export async function setReportTemplateConfig(
  configKey: string,
  configValue: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('set_report_template_config', {
      p_config_key: configKey,
      p_config_value: configValue,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getAttendanceForExam(
  examId: string,
  options: RequestOptions = {}
): Promise<AttendanceRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_attendance_for_exam', { p_exam_id: examId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeAttendance(data);
}

export async function saveAttendanceForExam(
  examId: string,
  entries: Array<{ student_id: string; status: string; remarks?: string }>,
  options: RequestOptions = {}
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .rpc('save_attendance_for_exam', {
      p_exam_id: examId,
      p_entries: entries,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
}

export async function getSubjectPapers(
  subjectId: string,
  options: RequestOptions = {}
): Promise<SubjectPaper[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_subject_papers', { p_subject_id: subjectId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeSubjectPapers(data);
}

export async function upsertSubjectPaper(
  subjectId: string,
  name: string,
  code?: string,
  maxMarks?: number,
  weight?: number,
  sortOrder?: number,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_subject_paper', {
      p_subject_id: subjectId,
      p_name: name,
      p_code: code ?? null,
      p_max_marks: maxMarks ?? 100,
      p_weight: weight ?? 1.0,
      p_sort_order: sortOrder ?? 0,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getPathways(
  options: RequestOptions = {}
): Promise<Pathway[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_pathways')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizePathways(data);
}

export async function upsertPathway(
  name: string,
  track?: string,
  description?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_pathway', {
      p_name: name,
      p_track: track ?? null,
      p_description: description ?? '',
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function assignStudentPathway(
  studentId: string,
  pathwayId: string,
  options: RequestOptions = {}
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .rpc('assign_student_pathway', {
      p_student_id: studentId,
      p_pathway_id: pathwayId,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
}

export async function getTimetable(
  classId?: string,
  teacherId?: string,
  options: RequestOptions = {}
): Promise<TimetableEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_timetable', { p_class_id: classId ?? null, p_teacher_id: teacherId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    entry_id: raw.entry_id ? String(raw.entry_id) : null,
    slot_id: String(raw.slot_id ?? ''),
    day_of_week: Number(raw.day_of_week ?? 0),
    period_number: Number(raw.period_number ?? 0),
    start_time: String(raw.start_time ?? ''),
    end_time: String(raw.end_time ?? ''),
    slot_label: raw.slot_label ? String(raw.slot_label) : null,
    class_id: raw.class_id ? String(raw.class_id) : null,
    class_name: raw.class_name ? String(raw.class_name) : null,
    stream_id: raw.stream_id ? String(raw.stream_id) : null,
    stream_name: raw.stream_name ? String(raw.stream_name) : null,
    subject_id: raw.subject_id ? String(raw.subject_id) : null,
    subject_name: raw.subject_name ? String(raw.subject_name) : null,
    teacher_id: raw.teacher_id ? String(raw.teacher_id) : null,
    teacher_name: raw.teacher_name ? String(raw.teacher_name) : null,
    room: raw.room ? String(raw.room) : null,
    notes: raw.notes ? String(raw.notes) : null,
  }));
}

export async function saveTimetableEntry(
  slotId: string,
  classId?: string,
  streamId?: string,
  subjectId?: string,
  teacherId?: string,
  room?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<{ success: boolean; entry_id?: string; conflicts: unknown[]; message: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('save_timetable_entry', {
      p_slot_id: slotId,
      p_class_id: classId ?? null,
      p_stream_id: streamId ?? null,
      p_subject_id: subjectId ?? null,
      p_teacher_id: teacherId ?? null,
      p_room: room ?? null,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  const result = data as Record<string, unknown>;
  return {
    success: Boolean(result.success),
    entry_id: result.entry_id ? String(result.entry_id) : undefined,
    conflicts: Array.isArray(result.conflicts) ? result.conflicts : [],
    message: String(result.message ?? ''),
  };
}

export async function upsertTimetableSlot(
  dayOfWeek: number,
  periodNumber: number,
  startTime: string,
  endTime: string,
  label?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_timetable_slot', {
      p_day_of_week: dayOfWeek,
      p_period_number: periodNumber,
      p_start_time: startTime,
      p_end_time: endTime,
      p_label: label ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getClassesWithStreams(
  options: RequestOptions = {}
): Promise<ClassWithStreams[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_classes_with_streams')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    class_id: String(raw.class_id ?? ''),
    class_name: String(raw.class_name ?? ''),
    stream_id: raw.stream_id ? String(raw.stream_id) : null,
    stream_name: raw.stream_name ? String(raw.stream_name) : null,
    student_count: Number(raw.student_count ?? 0),
  }));
}

export async function upsertClass(
  name: string,
  classId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_class', { p_name: name, p_class_id: classId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function deleteClass(classId: string, options: RequestOptions = {}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('delete_class', { p_class_id: classId }).abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
}

export async function deleteStream(streamId: string, options: RequestOptions = {}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('delete_stream', { p_stream_id: streamId }).abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
}

export async function upsertStream(
  classId: string,
  name: string,
  streamId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_stream', { p_class_id: classId, p_name: name, p_stream_id: streamId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getSubjectsWithDetails(
  options: RequestOptions = {}
): Promise<SubjectWithDetails[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_subjects_with_details')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    subject_id: String(raw.subject_id ?? ''),
    subject_name: String(raw.subject_name ?? ''),
    subject_code: raw.subject_code ? String(raw.subject_code) : null,
    department: String(raw.department ?? 'General'),
    is_compulsory: Boolean(raw.is_compulsory),
    paper_count: Number(raw.paper_count ?? 0),
  }));
}

export async function upsertSubject(
  name: string,
  code?: string,
  department?: string,
  isCompulsory?: boolean,
  subjectId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_subject', {
      p_name: name,
      p_code: code ?? null,
      p_department: department ?? null,
      p_is_compulsory: isCompulsory ?? false,
      p_subject_id: subjectId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getExamComments(
  examId?: string,
  studentId?: string,
  options: RequestOptions = {}
): Promise<ExamComment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_exam_comments', { p_exam_id: examId ?? null, p_student_id: studentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    comment_id: String(raw.comment_id ?? ''),
    exam_id: raw.exam_id ? String(raw.exam_id) : null,
    exam_name: raw.exam_name ? String(raw.exam_name) : null,
    student_id: raw.student_id ? String(raw.student_id) : null,
    student_name: raw.student_name ? String(raw.student_name) : null,
    category_name: raw.category_name ? String(raw.category_name) : null,
    comment_text: String(raw.comment_text ?? ''),
    comment_type: String(raw.comment_type ?? 'general'),
    target_type: String(raw.target_type ?? 'student'),
    created_by_name: raw.created_by_name ? String(raw.created_by_name) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function addExamComment(
  examId?: string,
  studentId?: string,
  commentText?: string,
  commentType?: string,
  targetType?: string,
  targetId?: string,
  categoryId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_exam_comment', {
      p_exam_id: examId ?? null,
      p_student_id: studentId ?? null,
      p_comment_text: commentText ?? '',
      p_comment_type: commentType ?? 'general',
      p_target_type: targetType ?? 'student',
      p_target_id: targetId ?? null,
      p_category_id: categoryId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getCommentCategories(
  categoryType?: string,
  options: RequestOptions = {}
): Promise<CommentCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_comment_categories', { p_category_type: categoryType ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    category_id: String(raw.category_id ?? ''),
    name: String(raw.name ?? ''),
    category_type: String(raw.category_type ?? 'general'),
    description: raw.description ? String(raw.description) : null,
  }));
}

export async function getLessonPlans(
  subjectId?: string,
  classId?: string,
  teacherId?: string,
  options: RequestOptions = {}
): Promise<LessonPlan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_lesson_plans', { p_subject_id: subjectId ?? null, p_class_id: classId ?? null, p_teacher_id: teacherId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    plan_id: String(raw.plan_id ?? ''),
    teacher_id: raw.teacher_id ? String(raw.teacher_id) : null,
    teacher_name: raw.teacher_name ? String(raw.teacher_name) : null,
    subject_id: raw.subject_id ? String(raw.subject_id) : null,
    subject_name: raw.subject_name ? String(raw.subject_name) : null,
    class_id: raw.class_id ? String(raw.class_id) : null,
    class_name: raw.class_name ? String(raw.class_name) : null,
    stream_id: raw.stream_id ? String(raw.stream_id) : null,
    stream_name: raw.stream_name ? String(raw.stream_name) : null,
    topic: String(raw.topic ?? ''),
    subtopic: raw.subtopic ? String(raw.subtopic) : null,
    learning_objectives: raw.learning_objectives ? String(raw.learning_objectives) : null,
    intended_outcomes: raw.intended_outcomes ? String(raw.intended_outcomes) : null,
    learning_activities: raw.learning_activities ? String(raw.learning_activities) : null,
    teaching_resources: raw.teaching_resources ? String(raw.teaching_resources) : null,
    assessment_methods: raw.assessment_methods ? String(raw.assessment_methods) : null,
    teacher_notes: raw.teacher_notes ? String(raw.teacher_notes) : null,
    planned_date: raw.planned_date ? String(raw.planned_date) : null,
    duration_minutes: raw.duration_minutes != null ? Number(raw.duration_minutes) : null,
    status: String(raw.status ?? 'planned'),
    completion_pct: Number(raw.completion_pct ?? 0),
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function createLessonPlan(
  topic: string,
  subjectId?: string,
  classId?: string,
  streamId?: string,
  teacherId?: string,
  timetableEntryId?: string,
  subtopic?: string,
  learningObjectives?: string,
  intendedOutcomes?: string,
  learningActivities?: string,
  teachingResources?: string,
  assessmentMethods?: string,
  teacherNotes?: string,
  plannedDate?: string,
  durationMinutes?: number,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_lesson_plan', {
      p_topic: topic,
      p_subject_id: subjectId ?? null,
      p_class_id: classId ?? null,
      p_stream_id: streamId ?? null,
      p_teacher_id: teacherId ?? null,
      p_timetable_entry_id: timetableEntryId ?? null,
      p_subtopic: subtopic ?? null,
      p_learning_objectives: learningObjectives ?? null,
      p_intended_outcomes: intendedOutcomes ?? null,
      p_learning_activities: learningActivities ?? null,
      p_teaching_resources: teachingResources ?? null,
      p_assessment_methods: assessmentMethods ?? null,
      p_teacher_notes: teacherNotes ?? null,
      p_planned_date: plannedDate ?? null,
      p_duration_minutes: durationMinutes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function updateLessonPlanStatus(
  planId: string,
  status: string,
  completionPct?: number,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('update_lesson_plan_status', {
      p_plan_id: planId,
      p_status: status,
      p_completion_pct: completionPct ?? 0,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getCurriculumCoverage(
  subjectId?: string,
  classId?: string,
  term?: string,
  academicYear?: number,
  options: RequestOptions = {}
): Promise<CurriculumCoverage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_curriculum_coverage', {
      p_subject_id: subjectId ?? null,
      p_class_id: classId ?? null,
      p_term: term ?? null,
      p_academic_year: academicYear ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    coverage_id: String(raw.coverage_id ?? ''),
    subject_id: String(raw.subject_id ?? ''),
    subject_name: raw.subject_name ? String(raw.subject_name) : null,
    class_id: raw.class_id ? String(raw.class_id) : null,
    class_name: raw.class_name ? String(raw.class_name) : null,
    term: String(raw.term ?? ''),
    academic_year: Number(raw.academic_year ?? 0),
    curriculum_topic: String(raw.curriculum_topic ?? ''),
    curriculum_subtopic: raw.curriculum_subtopic ? String(raw.curriculum_subtopic) : null,
    is_planned: Boolean(raw.is_planned),
    is_taught: Boolean(raw.is_taught),
    taught_date: raw.taught_date ? String(raw.taught_date) : null,
    taught_by_name: raw.taught_by_name ? String(raw.taught_by_name) : null,
    notes: raw.notes ? String(raw.notes) : null,
  }));
}

export async function upsertCurriculumCoverage(
  subjectId: string,
  term: string,
  academicYear: number,
  curriculumTopic: string,
  classId?: string,
  curriculumSubtopic?: string,
  isPlanned?: boolean,
  isTaught?: boolean,
  taughtDate?: string,
  lessonPlanId?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_curriculum_coverage', {
      p_subject_id: subjectId,
      p_term: term,
      p_academic_year: academicYear,
      p_curriculum_topic: curriculumTopic,
      p_class_id: classId ?? null,
      p_curriculum_subtopic: curriculumSubtopic ?? null,
      p_is_planned: isPlanned ?? false,
      p_is_taught: isTaught ?? false,
      p_taught_date: taughtDate ?? null,
      p_lesson_plan_id: lessonPlanId ?? null,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getCurriculumCoverageSummary(
  subjectId?: string,
  classId?: string,
  term?: string,
  academicYear?: number,
  options: RequestOptions = {}
): Promise<CurriculumCoverageSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_curriculum_coverage_summary', {
      p_subject_id: subjectId ?? null,
      p_class_id: classId ?? null,
      p_term: term ?? null,
      p_academic_year: academicYear ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    subject_id: String(raw.subject_id ?? ''),
    subject_name: raw.subject_name ? String(raw.subject_name) : null,
    class_id: raw.class_id ? String(raw.class_id) : null,
    class_name: raw.class_name ? String(raw.class_name) : null,
    total_topics: Number(raw.total_topics ?? 0),
    planned_topics: Number(raw.planned_topics ?? 0),
    taught_topics: Number(raw.taught_topics ?? 0),
    coverage_pct: Number(raw.coverage_pct ?? 0),
  }));
}
