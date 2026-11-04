import { createClient } from '@/lib/supabase/client';
import { AnalyticsAPIError } from './errors';
import {
  AnalyticsContractError,
  normalizeAccountDirectory,
  normalizeClasses,
  normalizeClassPerformance,
  normalizeExamMarkEntryRoster,
  normalizeExamPipelineOverview,
  normalizeExamPublishReadiness,
  normalizeExams,
  normalizeExamSetupOptions,
  normalizeGradeDistribution,
  normalizeMarkSheet,
  normalizeMessageLog,
  normalizeAttendance,
  normalizeFeePayments,
  normalizeFeePledges,
  normalizeFeeStructures,
  normalizeBehaviour,
  normalizeMessageRecipients,
  normalizePathways,
  normalizePendingSms,
  normalizeStudentGroups,
  normalizeStudentMemberships,
  normalizeStudentNotes,
  normalizeStudentResidences,
  normalizeSubjectPapers,
  normalizeMostImproved,
  normalizePermissionCatalogue,
  normalizeReportTemplateConfig,
  normalizeRolesWithPermissions,
  normalizeSchoolProfile,
  normalizeSchoolValidity,
  normalizeSectionHeads,
  normalizeStaffGroups,
  normalizeStreams,
  normalizeStudentDirectory,
  normalizeStudentExamHistory,
  normalizeStudentProfile,
  normalizeStudentReport,
  normalizeSubjectPublishStatus,
  normalizeSubjectPerformance,
  normalizeTeacherAllocations,
  normalizeTeacherDirectory,
  normalizeTeacherSubjectClassPerformance,
  normalizeTermDates,
  normalizeUserPermissionProfile,
} from './guards';
import type {
  AccountDirectoryRow,
  AssessmentComponentCode,
  ClassOption,
  AttendanceSummaryRow,
  ClassWithStreams,
  CurriculumCoverage,
  CurriculumCoverageSummary,
  BookLoan,
  BoardingRollCall,
  DailyAttendanceRow,
  MealPlan,
  LibraryBook,
  DataRetentionPolicy,
  LessonPlan,
  DutyAssignment,
  DutyRoster,
  Substitution,
  LeaveRequest,
  LeaveType,
  EmergencyContact,
  MedicalAlert,
  Budget,
  BudgetVsActual,
  CashBookEntry,
  ChartOfAccount,
  TrialBalanceRow,
  CounsellingReferral,
  CounsellingSession,
  ClassPerformanceStudent,
  ExamLifecycleStatus,
  ExamMarkEntryRow,
  EventRow,
  ExamComment,
  CommentCategory,
  ExamOption,
  Invoice,
  Receipt,
  NoticeRow,
  Opportunity,
  OpportunityApplication,
  FeeBalance,
  FeeWaiver,
  FiscalPeriod,
  FeePayment,
  FeePledge,
  FeeStructure,
  ExamPipelineRow,
  ExamPublishReadinessRow,
  ExamSetupOptions,
  GradeDistribution,
  MarkSheetRow,
  AttendanceRow,
  BankStatement,
  BankStatementLine,
  AuditEvent,
  BehaviourRow,
  MedicalInventoryItem,
  MedicalVisit,
  MessageLogRow,
  MessageRecipients,
  MostImprovedRow,
  Pathway,
  SalaryComponent,
  EmployeeSalary,
  PayrollEntry,
  PayrollPeriod,
  ParentRow,
  ParentStudentLink,
  StudentGroup,
  StudentMembership,
  StudentNote,
  StudentResidence,
  SubjectPaper,
  PendingSmsRow,
  SmsGatewayConfig,
  PermissionCatalogueItem,
  ReportTemplateConfig,
  RoleWithPermissionsRow,
  SchoolProfile,
  SchoolValidity,
  SectionHeadRow,
  StaffGroupRow,
  StaffDirectoryRow,
  StaffType,
  StreamOption,
  StudentDirectoryRow,
  StudentExamHistoryRow,
  StudentProfileData,
  StudentReportData,
  SubjectPerformance,
  SubjectWithDetails,
  SubjectPublishStatusRow,
  TeacherAllocationRow,
  TeacherAllocationType,
  TeacherDirectoryRow,
  TeacherSubjectClassPerformanceRow,
  TeacherWorkload,
  SportsEvent,
  SportsParticipation,
  Sport,
  StudentTransport,
  TimetableEntry,
  Trip,
  TripParticipant,
  TransportRoute,
  Vehicle,
  VoteHead,
  VoteHeadCategory,
  FeeStructureGroup,
  FeeCollection,
  ReversalReason,
  StudentVoteHeadBalance,
  Wallet,
  WalletTransaction,
  TermDateRow,
  UserPermissionProfile,
  FeeLedgerEntry,
} from './types';

export interface RequestOptions {
  signal?: AbortSignal;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
}

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

export async function getAccountDirectory(
  options: RequestOptions = {}
): Promise<AccountDirectoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_account_directory')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeAccountDirectory(data);
}

export async function getPermissionCatalogue(
  options: RequestOptions = {}
): Promise<PermissionCatalogueItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_permission_catalogue')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizePermissionCatalogue(data);
}

export async function getRolesWithPermissions(
  options: RequestOptions = {}
): Promise<RoleWithPermissionsRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_roles_with_permissions')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeRolesWithPermissions(data);
}

export interface UpsertCustomRoleInput {
  roleKey?: string;
  displayName: string;
  description?: string;
  staffType: StaffType;
  permissionCodes: string[];
}

export async function upsertCustomRole(
  input: UpsertCustomRoleInput,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_custom_role', {
      p_role_key: input.roleKey ?? input.displayName,
      p_display_name: input.displayName,
      p_description: input.description ?? '',
      p_staff_type: input.staffType,
      p_permission_codes: input.permissionCodes,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) {
    throw new AnalyticsContractError('upsert_custom_role');
  }
  return data;
}

export async function deleteCustomRole(
  roleKey: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('delete_custom_role', { p_role_key: roleKey })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getUserPermissionProfile(
  userId: string,
  options: RequestOptions = {}
): Promise<UserPermissionProfile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_user_permission_profile', { p_user_id: userId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeUserPermissionProfile(data);
}

export interface MyPermissions {
  userId: string;
  role: string | null;
  isAdmin: boolean;
  permissions: string[];
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

export async function getMyPermissions(
  options: RequestOptions = {}
): Promise<MyPermissions> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_my_permissions')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    userId: String(row.user_id ?? ''),
    role: typeof row.role === 'string' ? row.role : null,
    isAdmin: row.is_admin === true,
    permissions: Array.isArray(row.permissions) ? row.permissions.map(String) : [],
  };
}

export interface MyChild {
  studentId: string;
  fullName: string;
  admissionNo: string;
  className: string | null;
  relationship: string;
  isPrimary: boolean;
}

export interface MyChildFeeLine {
  voteHeadId: string;
  voteHeadName: string;
  balance: number;
}

export interface MyChildPayment {
  collectionId: string;
  amount: number;
  paymentMethod: string | null;
  referenceNumber: string | null;
  term: string | null;
  academicYear: number | null;
  collectedAt: string;
}

export interface MyChildResult {
  examId: string;
  examName: string;
  term: string | null;
  academicYear: number | null;
  subjectName: string;
  score: number;
}

export interface MyChildAttendanceCount {
  status: string;
  days: number;
}

async function parentRpc<T>(
  fn: string,
  args: Record<string, unknown> | undefined,
  options: RequestOptions
): Promise<T[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc(fn, args)
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []) as T[];
}

export async function getMyChildren(options: RequestOptions = {}): Promise<MyChild[]> {
  const rows = await parentRpc<Record<string, unknown>>('get_my_children', undefined, options);
  return rows.map((r) => ({
    studentId: String(r.student_id),
    fullName: String(r.full_name ?? ''),
    admissionNo: String(r.admission_no ?? ''),
    className: typeof r.class_name === 'string' ? r.class_name : null,
    relationship: String(r.relationship ?? 'parent'),
    isPrimary: r.is_primary === true,
  }));
}

export async function getMyChildFees(
  studentId: string,
  options: RequestOptions = {}
): Promise<MyChildFeeLine[]> {
  const rows = await parentRpc<Record<string, unknown>>('get_my_child_fees', { p_student_id: studentId }, options);
  return rows.map((r) => ({
    voteHeadId: String(r.vote_head_id),
    voteHeadName: String(r.vote_head_name ?? ''),
    balance: Number(r.balance ?? 0),
  }));
}

export async function getMyChildPayments(
  studentId: string,
  limit = 50,
  options: RequestOptions = {}
): Promise<MyChildPayment[]> {
  const rows = await parentRpc<Record<string, unknown>>(
    'get_my_child_payments',
    { p_student_id: studentId, p_limit: limit },
    options
  );
  return rows.map((r) => ({
    collectionId: String(r.collection_id),
    amount: Number(r.amount ?? 0),
    paymentMethod: typeof r.payment_method === 'string' ? r.payment_method : null,
    referenceNumber: typeof r.reference_number === 'string' ? r.reference_number : null,
    term: typeof r.term === 'string' ? r.term : null,
    academicYear: typeof r.academic_year === 'number' ? r.academic_year : null,
    collectedAt: String(r.collected_at ?? ''),
  }));
}

export async function getMyChildResults(
  studentId: string,
  options: RequestOptions = {}
): Promise<MyChildResult[]> {
  const rows = await parentRpc<Record<string, unknown>>('get_my_child_results', { p_student_id: studentId }, options);
  return rows.map((r) => ({
    examId: String(r.exam_id),
    examName: String(r.exam_name ?? ''),
    term: typeof r.term === 'string' ? r.term : null,
    academicYear: typeof r.academic_year === 'number' ? r.academic_year : null,
    subjectName: String(r.subject_name ?? ''),
    score: Number(r.score ?? 0),
  }));
}

export async function getMyChildAttendance(
  studentId: string,
  academicYear?: number,
  options: RequestOptions = {}
): Promise<MyChildAttendanceCount[]> {
  const rows = await parentRpc<Record<string, unknown>>(
    'get_my_child_attendance',
    { p_student_id: studentId, p_academic_year: academicYear ?? null },
    options
  );
  return rows.map((r) => ({ status: String(r.status), days: Number(r.days ?? 0) }));
}

export async function setMyPhone(phone: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('set_my_phone', { p_phone: phone });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  if (typeof data !== 'string' || data === '') {
    throw new Error('Phone number was not saved.');
  }
  return data;
}

export interface SaveUserPermissionOverridesInput {
  userId: string;
  grantCodes?: string[];
  denyCodes?: string[];
  clearCodes?: string[];
}

export async function saveUserPermissionOverrides(
  input: SaveUserPermissionOverridesInput,
  options: RequestOptions = {}
): Promise<UserPermissionProfile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('save_user_permission_overrides', {
      p_user_id: input.userId,
      p_grant_codes: input.grantCodes ?? [],
      p_deny_codes: input.denyCodes ?? [],
      p_clear_codes: input.clearCodes ?? [],
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeUserPermissionProfile(data);
}

export async function setUserAccessRevoked(
  userId: string,
  revoked: boolean,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('set_user_access_revoked', {
      p_user_id: userId,
      p_revoked: revoked,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export interface InviteOrCreateAccountInput {
  fullName: string;
  email: string;
  role: string;
  staffType: StaffType;
}

export async function inviteOrCreateAccount(
  input: InviteOrCreateAccountInput,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('invite_or_create_account', {
      p_full_name: input.fullName,
      p_email: input.email,
      p_role: input.role,
      p_staff_type: input.staffType,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) {
    throw new AnalyticsContractError('invite_or_create_account');
  }
  return data;
}

export interface UpdateAccountProfileInput {
  userId: string;
  fullName: string;
  email?: string | null;
  role: string;
  staffType: StaffType;
  isActive: boolean;
}

export async function updateAccountProfile(
  input: UpdateAccountProfileInput,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('update_account_profile', {
      p_user_id: input.userId,
      p_full_name: input.fullName,
      p_email: input.email ?? '',
      p_role: input.role,
      p_staff_type: input.staffType,
      p_is_active: input.isActive,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getSectionHeads(
  options: RequestOptions = {}
): Promise<SectionHeadRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_section_heads')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeSectionHeads(data);
}

export async function upsertSectionHead(
  formLevel: string,
  userId: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_section_head', {
      p_form_level: formLevel,
      p_user_id: userId,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) {
    throw new AnalyticsContractError('upsert_section_head');
  }
  return data;
}

export async function deleteSectionHead(
  sectionHeadId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('delete_section_head', {
      p_section_head_id: sectionHeadId,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
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

export async function getTeacherDirectory(
  options: RequestOptions = {}
): Promise<TeacherDirectoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_teacher_directory')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeTeacherDirectory(data);
}

export interface UpsertTeacherProfileInput {
  userId?: string | null;
  fullName: string;
  email: string;
  phone?: string;
  initials?: string;
  tscNumber?: string;
  nationalId?: string;
  employeeNumber?: string;
  gender?: string;
  role?: string;
  groupNames?: string[];
  isActive?: boolean;
}

export async function upsertTeacherProfile(
  input: UpsertTeacherProfileInput,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_teacher_profile', {
      p_user_id: input.userId || null,
      p_full_name: input.fullName,
      p_email: input.email,
      p_phone: input.phone ?? null,
      p_initials: input.initials ?? null,
      p_tsc_number: input.tscNumber ?? null,
      p_national_id: input.nationalId ?? null,
      p_employee_number: input.employeeNumber ?? null,
      p_gender: input.gender ?? null,
      p_role: input.role ?? 'teacher',
      p_group_names: input.groupNames ?? [],
      p_is_active: input.isActive ?? true,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) {
    throw new AnalyticsContractError('upsert_teacher_profile');
  }
  return data;
}

export async function getStaffGroups(
  options: RequestOptions = {}
): Promise<StaffGroupRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_staff_groups')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeStaffGroups(data);
}

export async function upsertStaffGroup(
  name: string,
  staffType: StaffType = 'TEACHER',
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_staff_group', {
      p_name: name,
      p_staff_type: staffType,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) {
    throw new AnalyticsContractError('upsert_staff_group');
  }
  return data;
}

export async function deleteStaffGroup(
  groupId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('delete_staff_group', { p_group_id: groupId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getTeacherAllocations(
  academicYear?: number,
  options: RequestOptions = {}
): Promise<TeacherAllocationRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_teacher_allocations', {
      p_academic_year: academicYear ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeTeacherAllocations(data);
}

export interface UpsertTeacherAllocationInput {
  allocationType: TeacherAllocationType;
  classId: string;
  streamId?: string | null;
  subjectId?: string | null;
  teacherId: string;
  academicYear?: number;
}

export async function upsertTeacherAllocation(
  input: UpsertTeacherAllocationInput,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_teacher_allocation', {
      p_allocation_type: input.allocationType,
      p_class_id: input.classId,
      p_stream_id: input.streamId || null,
      p_subject_id: input.subjectId || null,
      p_teacher_id: input.teacherId,
      p_academic_year: input.academicYear ?? new Date().getFullYear(),
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) {
    throw new AnalyticsContractError('upsert_teacher_allocation');
  }
  return data;
}

export async function deleteTeacherAllocation(
  allocationType: TeacherAllocationType,
  allocationId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('delete_teacher_allocation', {
      p_allocation_type: allocationType,
      p_allocation_id: allocationId,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getTeacherSubjectClassPerformance(
  examId: string,
  teacherId?: string,
  options: RequestOptions = {}
): Promise<TeacherSubjectClassPerformanceRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_teacher_subject_class_performance', {
      p_exam_id: examId,
      p_teacher_id: teacherId || null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeTeacherSubjectClassPerformance(data);
}

export async function getStudentDirectory(
  search?: string,
  classId?: string,
  streamId?: string,
  limit?: number,
  options: RequestOptions = {}
): Promise<StudentDirectoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_directory', {
      p_search: search || null,
      p_class_id: classId || null,
      p_stream_id: streamId || null,
      p_limit: limit ?? 50,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeStudentDirectory(data);
}

export async function getStudentProfile(
  studentId: string,
  options: RequestOptions = {}
): Promise<StudentProfileData> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_profile', { p_student_id: studentId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeStudentProfile(data);
}

export interface NewStudentExtra {
  dateOfBirth?: string;
  guardianName?: string;
  guardianRelation?: string;
  primaryPhone?: string;
  previousSchool?: string;
}

export async function createStudent(
  admissionNo: string,
  fullName: string,
  gender?: string,
  classId?: string,
  streamId?: string,
  academicYear?: number,
  extra: NewStudentExtra = {},
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_student', {
      p_admission_no: admissionNo,
      p_full_name: fullName,
      p_gender: gender ?? null,
      p_class_id: classId || null,
      p_stream_id: streamId || null,
      p_academic_year: academicYear ?? null,
      p_date_of_birth: extra.dateOfBirth || null,
      p_guardian_name: extra.guardianName || null,
      p_guardian_relation: extra.guardianRelation || null,
      p_primary_phone: extra.primaryPhone || null,
      p_previous_school: extra.previousSchool || null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) {
    throw new AnalyticsContractError('create_student');
  }
  return data;
}

export async function updateStudentProfile(
  studentId: string,
  admissionNo?: string,
  fullName?: string,
  gender?: string,
  classId?: string,
  streamId?: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('update_student_profile', {
      p_student_id: studentId,
      p_admission_no: admissionNo ?? null,
      p_full_name: fullName ?? null,
      p_gender: gender ?? null,
      p_class_id: classId || null,
      p_stream_id: streamId || null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function moveStudent(
  studentId: string,
  action: string,
  destinationClassId?: string,
  destinationStreamId?: string,
  academicYear?: number,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('move_student', {
      p_student_id: studentId,
      p_action: action,
      p_destination_class_id: destinationClassId || null,
      p_destination_stream_id: destinationStreamId || null,
      p_academic_year: academicYear ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getSchoolProfile(
  options: RequestOptions = {}
): Promise<SchoolProfile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_school_profile')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeSchoolProfile(data);
}

export async function updateSchoolProfile(
  input: {
    name?: string;
    schoolType?: string;
    country?: string;
    region?: string;
    county?: string;
    educationSystem?: string;
    ownershipType?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    watermarkUrl?: string;
    logoUrl?: string;
    motto?: string;
  },
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('update_school_profile', {
      p_name: input.name ?? null,
      p_school_type: input.schoolType ?? null,
      p_country: input.country ?? null,
      p_region: input.region ?? null,
      p_county: input.county ?? null,
      p_education_system: input.educationSystem ?? null,
      p_ownership_type: input.ownershipType ?? null,
      p_contact_person: input.contactPerson ?? null,
      p_contact_phone: input.contactPhone ?? null,
      p_contact_email: input.contactEmail ?? null,
      p_watermark_url: input.watermarkUrl ?? null,
      p_logo_url: input.logoUrl ?? null,
      p_motto: input.motto ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getSchoolValidity(
  options: RequestOptions = {}
): Promise<SchoolValidity> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_school_validity')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeSchoolValidity(data);
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

export async function logMessage(
  recipientType: string,
  recipientIds: string[],
  messageType: string,
  subject: string | null,
  messageBody: string,
  phoneNumbers: string[],
  recipientCount: number,
  creditsUsed: number,
  examId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('log_message', {
      p_recipient_type: recipientType,
      p_recipient_ids: recipientIds,
      p_message_type: messageType,
      p_subject: subject,
      p_message_body: messageBody,
      p_phone_numbers: phoneNumbers,
      p_recipient_count: recipientCount,
      p_credits_used: creditsUsed,
      p_exam_id: examId || null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) {
    throw new AnalyticsContractError('log_message');
  }
  return data;
}

export async function getMessageHistory(
  limit?: number,
  options: RequestOptions = {}
): Promise<MessageLogRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_message_history', { p_limit: limit ?? 50 })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeMessageLog(data);
}

export async function getMessageRecipients(
  options: RequestOptions = {}
): Promise<MessageRecipients> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_message_recipients')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeMessageRecipients(data);
}

export async function getPendingSms(
  options: RequestOptions = {}
): Promise<PendingSmsRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_pending_sms')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizePendingSms(data);
}

export async function updateSmsStatus(
  messageId: string,
  status: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('update_sms_status', {
      p_message_id: messageId,
      p_status: status,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getSmsGatewayConfig(
  options: RequestOptions = {}
): Promise<SmsGatewayConfig> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_sms_gateway_config')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'object' || data === null) {
    throw new AnalyticsContractError('sms gateway config');
  }
  const payload = data as Record<string, unknown>;
  return {
    tenant_id: String(payload.tenant_id ?? ''),
    gateway_type: String(payload.gateway_type ?? ''),
    description: String(payload.description ?? ''),
    companion_app: String(payload.companion_app ?? ''),
    mechanism: String(payload.mechanism ?? ''),
    required_permissions: Array.isArray(payload.required_permissions)
      ? payload.required_permissions.map(String)
      : [],
    supports_dual_sim: Boolean(payload.supports_dual_sim),
    supports_delivery_tracking: Boolean(payload.supports_delivery_tracking),
    max_batch_size: Number(payload.max_batch_size ?? 0),
  };
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

export async function getBehaviourForStudent(
  studentId: string,
  options: RequestOptions = {}
): Promise<BehaviourRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_behaviour_for_student', { p_student_id: studentId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeBehaviour(data);
}

export async function getStudentNotes(
  studentId: string,
  options: RequestOptions = {}
): Promise<StudentNote[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_notes', { p_student_id: studentId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeStudentNotes(data);
}

export async function getStudentMemberships(
  studentId: string,
  options: RequestOptions = {}
): Promise<StudentMembership[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_memberships', { p_student_id: studentId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeStudentMemberships(data);
}

export async function addStudentNote(
  studentId: string,
  noteType: string,
  title: string,
  content: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_student_note', {
      p_student_id: studentId,
      p_note_type: noteType,
      p_title: title,
      p_content: content,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function deleteStudentNote(
  noteId: string,
  options: RequestOptions = {}
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .rpc('delete_student_note', { p_note_id: noteId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
}

export async function getStudentGroups(
  options: RequestOptions = {}
): Promise<StudentGroup[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_groups')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeStudentGroups(data);
}

export async function upsertStudentGroup(
  name: string,
  description?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_student_group', {
      p_name: name,
      p_description: description ?? '',
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function assignStudentToGroup(
  studentId: string,
  groupId: string,
  options: RequestOptions = {}
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .rpc('assign_student_to_group', {
      p_student_id: studentId,
      p_group_id: groupId,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
}

export async function getStudentResidences(
  options: RequestOptions = {}
): Promise<StudentResidence[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_residences')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeStudentResidences(data);
}

export async function upsertStudentResidence(
  name: string,
  residenceType?: string,
  capacity?: number,
  supervisorId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_student_residence', {
      p_name: name,
      p_type: residenceType ?? 'Dormitory',
      p_capacity: capacity ?? null,
      p_supervisor_id: supervisorId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function assignStudentResidence(
  studentId: string,
  residenceId: string,
  options: RequestOptions = {}
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .rpc('assign_student_residence', {
      p_student_id: studentId,
      p_residence_id: residenceId,
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

export async function getFeeStructures(
  academicYear?: number,
  term?: string,
  options: RequestOptions = {}
): Promise<FeeStructure[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_structures', { p_academic_year: academicYear ?? null, p_term: term ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeFeeStructures(data);
}

export async function upsertFeeStructure(
  classId: string | null,
  academicYear: number,
  term: string,
  name: string,
  amount: number,
  description?: string,
  isActive?: boolean,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_fee_structure', {
      p_class_id: classId,
      p_academic_year: academicYear,
      p_term: term,
      p_name: name,
      p_amount: amount,
      p_description: description ?? null,
      p_is_active: isActive ?? true,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getFeeBalances(
  search?: string,
  classId?: string,
  term?: string,
  academicYear?: number,
  balanceFilter?: string,
  minBalance?: number,
  maxBalance?: number,
  sortBy?: string,
  sortDir?: string,
  page?: number,
  pageSize?: number,
  options: RequestOptions = {}
): Promise<{ rows: Record<string, unknown>[]; total: number; page: number; page_size: number; summary: Record<string, unknown> }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_balances', {
      p_search: search ?? null,
      p_class_id: classId ?? null,
      p_term: term ?? null,
      p_academic_year: academicYear ?? null,
      p_balance_filter: balanceFilter ?? 'all',
      p_min_balance: minBalance ?? null,
      p_max_balance: maxBalance ?? null,
      p_sort_by: sortBy ?? 'admission_no',
      p_sort_dir: sortDir ?? 'asc',
      p_page: page ?? 1,
      p_page_size: pageSize ?? 25,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (data ?? {}) as { rows: Record<string, unknown>[]; total: number; page: number; page_size: number; summary: Record<string, unknown> };
}

export async function getStudentFeeBalance(
  studentId: string,
  academicYear?: number,
  term?: string,
  options: RequestOptions = {}
): Promise<FeeBalance> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_fee_balance', { p_student_id: studentId, p_academic_year: academicYear ?? null, p_term: term ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  const payload = data as Record<string, unknown>;
  return {
    student_id: String(payload.student_id ?? ''),
    student_name: payload.student_name ? String(payload.student_name) : null,
    admission_no: String(payload.admission_no ?? ''),
    total_fees: Number(payload.total_fees ?? 0),
    total_paid: Number(payload.total_paid ?? 0),
    total_waived: Number(payload.total_waived ?? 0),
    balance: Number(payload.balance ?? 0),
  };
}

export async function recordFeePayment(
  studentId: string,
  amount: number,
  paymentMethod: string,
  referenceNumber?: string,
  academicYear?: number,
  term?: string,
  notes?: string,
  idempotencyKey?: string,
  paymentDate?: string,
  allocations?: { vote_head_id?: string; fee_structure_id?: string; amount: number }[],
  paidBy?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('record_fee_payment', {
      p_student_id: studentId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_reference_number: referenceNumber ?? null,
      p_academic_year: academicYear ?? null,
      p_term: term ?? null,
      p_notes: notes ?? null,
      p_idempotency_key: idempotencyKey ?? null,
      p_payment_date: paymentDate ?? null,
      p_allocations: allocations ? JSON.stringify(allocations) : null,
      p_paid_by: paidBy ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getFeePayments(
  studentId?: string,
  limit?: number,
  options: RequestOptions = {}
): Promise<FeePayment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_payments', { p_student_id: studentId ?? null, p_limit: limit ?? 50 })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeFeePayments(data);
}

export async function getFeeLedgerReport(
  studentId?: string,
  limit = 500,
  options: RequestOptions = {}
): Promise<FeeLedgerEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_ledger_report', {
      p_student_id: studentId ?? null,
      p_limit: limit,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    payment_id: String(raw.payment_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    amount: Number(raw.amount ?? 0),
    payment_method: String(raw.payment_method ?? 'cash'),
    reference_number: raw.reference_number ? String(raw.reference_number) : null,
    academic_year: raw.academic_year ? Number(raw.academic_year) : null,
    term: raw.term ? String(raw.term) : null,
    notes: raw.notes ? String(raw.notes) : null,
    recorded_by_name: raw.recorded_by_name ? String(raw.recorded_by_name) : null,
    paid_at: String(raw.paid_at ?? ''),
    entry_type: raw.entry_type === 'reversal' ? 'reversal' : 'payment',
    reversal_reason: raw.reversal_reason ? String(raw.reversal_reason) : null,
    receipt_id: raw.receipt_id ? String(raw.receipt_id) : null,
    receipt_number: raw.receipt_number ? String(raw.receipt_number) : null,
  }));
}

export async function getFeePledges(
  studentId?: string,
  options: RequestOptions = {}
): Promise<FeePledge[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_pledges', { p_student_id: studentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeFeePledges(data);
}

export async function createFeePledge(
  studentId: string,
  pledgedAmount: number,
  dueDate?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_fee_pledge', {
      p_student_id: studentId,
      p_pledged_amount: pledgedAmount,
      p_due_date: dueDate ?? null,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
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

export async function getEvents(
  startDate?: string,
  endDate?: string,
  options: RequestOptions = {}
): Promise<EventRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_events', { p_start_date: startDate ?? null, p_end_date: endDate ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    event_id: String(raw.event_id ?? ''),
    title: String(raw.title ?? ''),
    description: raw.description ? String(raw.description) : null,
    event_type: String(raw.event_type ?? 'general'),
    start_date: String(raw.start_date ?? ''),
    end_date: raw.end_date ? String(raw.end_date) : null,
    location: raw.location ? String(raw.location) : null,
    is_all_day: Boolean(raw.is_all_day),
    created_by_name: raw.created_by_name ? String(raw.created_by_name) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function createEvent(
  title: string,
  description?: string,
  eventType?: string,
  startDate?: string,
  endDate?: string,
  location?: string,
  isAllDay?: boolean,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_event', {
      p_title: title,
      p_description: description ?? null,
      p_event_type: eventType ?? 'general',
      p_start_date: startDate ?? new Date().toISOString(),
      p_end_date: endDate ?? null,
      p_location: location ?? null,
      p_is_all_day: isAllDay ?? false,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getNotices(
  targetAudience?: string,
  options: RequestOptions = {}
): Promise<NoticeRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_notices', { p_target_audience: targetAudience ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    notice_id: String(raw.notice_id ?? ''),
    title: String(raw.title ?? ''),
    content: String(raw.content ?? ''),
    notice_type: String(raw.notice_type ?? 'general'),
    target_audience: String(raw.target_audience ?? 'all'),
    is_published: Boolean(raw.is_published),
    published_at: raw.published_at ? String(raw.published_at) : null,
    expires_at: raw.expires_at ? String(raw.expires_at) : null,
    created_by_name: raw.created_by_name ? String(raw.created_by_name) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function createNotice(
  title: string,
  content: string,
  noticeType?: string,
  targetAudience?: string,
  isPublished?: boolean,
  expiresAt?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_notice', {
      p_title: title,
      p_content: content,
      p_notice_type: noticeType ?? 'general',
      p_target_audience: targetAudience ?? 'all',
      p_is_published: isPublished ?? false,
      p_expires_at: expiresAt ?? null,
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

export async function getStaffDirectory(
  staffType?: string,
  options: RequestOptions = {}
): Promise<StaffDirectoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_staff_directory', { p_staff_type: staffType ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    staff_id: String(raw.staff_id ?? ''),
    full_name: raw.full_name ? String(raw.full_name) : null,
    email: raw.email ? String(raw.email) : null,
    role: raw.role ? String(raw.role) : null,
    staff_type: raw.staff_type ? String(raw.staff_type) : null,
    is_active: Boolean(raw.is_active),
    class_count: Number(raw.class_count ?? 0),
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function upsertStaffProfile(
  fullName: string,
  email?: string,
  role?: string,
  staffType?: string,
  isActive?: boolean,
  staffId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_staff_profile', {
      p_full_name: fullName,
      p_email: email ?? null,
      p_role: role ?? 'teacher',
      p_staff_type: staffType ?? 'TEACHER',
      p_is_active: isActive ?? true,
      p_staff_id: staffId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getCounsellingSessions(
  studentId?: string,
  options: RequestOptions = {}
): Promise<CounsellingSession[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_counselling_sessions', { p_student_id: studentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    session_id: String(raw.session_id ?? ''),
    student_id: raw.student_id ? String(raw.student_id) : null,
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: raw.admission_no ? String(raw.admission_no) : null,
    counsellor_name: raw.counsellor_name ? String(raw.counsellor_name) : null,
    session_date: String(raw.session_date ?? ''),
    session_type: String(raw.session_type ?? 'individual'),
    topic: raw.topic ? String(raw.topic) : null,
    notes: raw.notes ? String(raw.notes) : null,
    outcome: raw.outcome ? String(raw.outcome) : null,
    follow_up_date: raw.follow_up_date ? String(raw.follow_up_date) : null,
    status: String(raw.status ?? 'scheduled'),
  }));
}

export async function createCounsellingSession(
  studentId?: string,
  sessionType?: string,
  topic?: string,
  notes?: string,
  sessionDate?: string,
  outcome?: string,
  followUpDate?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_counselling_session', {
      p_student_id: studentId ?? null,
      p_session_type: sessionType ?? 'individual',
      p_topic: topic ?? null,
      p_notes: notes ?? null,
      p_session_date: sessionDate ?? new Date().toISOString(),
      p_outcome: outcome ?? null,
      p_follow_up_date: followUpDate ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getCounsellingReferrals(
  studentId?: string,
  options: RequestOptions = {}
): Promise<CounsellingReferral[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_counselling_referrals', { p_student_id: studentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    referral_id: String(raw.referral_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    referred_by_name: raw.referred_by_name ? String(raw.referred_by_name) : null,
    reason: String(raw.reason ?? ''),
    urgency: String(raw.urgency ?? 'normal'),
    status: String(raw.status ?? 'pending'),
    notes: raw.notes ? String(raw.notes) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function createCounsellingReferral(
  studentId: string,
  reason: string,
  urgency?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_counselling_referral', {
      p_student_id: studentId,
      p_reason: reason,
      p_urgency: urgency ?? 'normal',
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getMedicalVisits(
  studentId?: string,
  options: RequestOptions = {}
): Promise<MedicalVisit[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_medical_visits', { p_student_id: studentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    visit_id: String(raw.visit_id ?? ''),
    student_id: raw.student_id ? String(raw.student_id) : null,
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: raw.admission_no ? String(raw.admission_no) : null,
    visit_date: String(raw.visit_date ?? ''),
    complaint: raw.complaint ? String(raw.complaint) : null,
    diagnosis: raw.diagnosis ? String(raw.diagnosis) : null,
    treatment: raw.treatment ? String(raw.treatment) : null,
    referred_to: raw.referred_to ? String(raw.referred_to) : null,
    attended_by_name: raw.attended_by_name ? String(raw.attended_by_name) : null,
    status: String(raw.status ?? 'completed'),
    notes: raw.notes ? String(raw.notes) : null,
  }));
}

export async function createMedicalVisit(
  studentId?: string,
  complaint?: string,
  diagnosis?: string,
  treatment?: string,
  referredTo?: string,
  status?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_medical_visit', {
      p_student_id: studentId ?? null,
      p_complaint: complaint ?? null,
      p_diagnosis: diagnosis ?? null,
      p_treatment: treatment ?? null,
      p_referred_to: referredTo ?? null,
      p_status: status ?? 'completed',
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getMedicalInventory(
  options: RequestOptions = {}
): Promise<MedicalInventoryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_medical_inventory')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    item_id: String(raw.item_id ?? ''),
    item_name: String(raw.item_name ?? ''),
    category: raw.category ? String(raw.category) : null,
    quantity: Number(raw.quantity ?? 0),
    unit: raw.unit ? String(raw.unit) : null,
    expiry_date: raw.expiry_date ? String(raw.expiry_date) : null,
    supplier: raw.supplier ? String(raw.supplier) : null,
  }));
}

export async function getParentStudentLinks(
  studentId?: string,
  parentId?: string,
  options: RequestOptions = {}
): Promise<ParentStudentLink[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_parent_student_links', { p_student_id: studentId ?? null, p_parent_id: parentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    link_id: String(raw.link_id ?? ''),
    parent_id: String(raw.parent_id ?? ''),
    parent_name: raw.parent_name ? String(raw.parent_name) : null,
    parent_email: raw.parent_email ? String(raw.parent_email) : null,
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    relationship: String(raw.relationship ?? 'parent'),
    is_primary: Boolean(raw.is_primary),
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function linkParentStudent(
  parentId: string,
  studentId: string,
  relationship?: string,
  isPrimary?: boolean,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('link_parent_student', {
      p_parent_id: parentId,
      p_student_id: studentId,
      p_relationship: relationship ?? 'parent',
      p_is_primary: isPrimary ?? false,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function unlinkParentStudent(
  linkId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('unlink_parent_student', { p_link_id: linkId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getParents(
  options: RequestOptions = {}
): Promise<ParentRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_parents')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    parent_id: String(raw.parent_id ?? ''),
    full_name: raw.full_name ? String(raw.full_name) : null,
    email: raw.email ? String(raw.email) : null,
    linked_students: Number(raw.linked_students ?? 0),
  }));
}

export async function getOpportunities(
  activeOnly?: boolean,
  options: RequestOptions = {}
): Promise<Opportunity[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_opportunities', { p_active_only: activeOnly ?? true })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    opportunity_id: String(raw.opportunity_id ?? ''),
    title: String(raw.title ?? ''),
    description: raw.description ? String(raw.description) : null,
    opportunity_type: String(raw.opportunity_type ?? 'scholarship'),
    eligibility_criteria: raw.eligibility_criteria ? String(raw.eligibility_criteria) : null,
    deadline: raw.deadline ? String(raw.deadline) : null,
    application_url: raw.application_url ? String(raw.application_url) : null,
    is_active: Boolean(raw.is_active),
    applicant_count: Number(raw.applicant_count ?? 0),
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function createOpportunity(
  title: string,
  description?: string,
  opportunityType?: string,
  eligibilityCriteria?: string,
  deadline?: string,
  applicationUrl?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_opportunity', {
      p_title: title,
      p_description: description ?? null,
      p_opportunity_type: opportunityType ?? 'scholarship',
      p_eligibility_criteria: eligibilityCriteria ?? null,
      p_deadline: deadline ?? null,
      p_application_url: applicationUrl ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function applyForOpportunity(
  opportunityId: string,
  studentId: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('apply_for_opportunity', {
      p_opportunity_id: opportunityId,
      p_student_id: studentId,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getOpportunityApplications(
  opportunityId?: string,
  options: RequestOptions = {}
): Promise<OpportunityApplication[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_opportunity_applications', { p_opportunity_id: opportunityId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    application_id: String(raw.application_id ?? ''),
    opportunity_id: String(raw.opportunity_id ?? ''),
    opportunity_title: raw.opportunity_title ? String(raw.opportunity_title) : null,
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    status: String(raw.status ?? 'applied'),
    notes: raw.notes ? String(raw.notes) : null,
    applied_at: String(raw.applied_at ?? ''),
  }));
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

export async function getInvoices(
  status?: string,
  options: RequestOptions = {}
): Promise<Invoice[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_invoices', { p_status: status ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    invoice_id: String(raw.invoice_id ?? ''),
    invoice_number: String(raw.invoice_number ?? ''),
    student_id: raw.student_id ? String(raw.student_id) : null,
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: raw.admission_no ? String(raw.admission_no) : null,
    amount: Number(raw.amount ?? 0),
    tax_amount: Number(raw.tax_amount ?? 0),
    total_amount: Number(raw.total_amount ?? 0),
    status: String(raw.status ?? 'draft'),
    due_date: raw.due_date ? String(raw.due_date) : null,
    issued_date: String(raw.issued_date ?? ''),
    notes: raw.notes ? String(raw.notes) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function createInvoice(
  invoiceNumber: string,
  studentId?: string,
  amount?: number,
  taxAmount?: number,
  dueDate?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_invoice', {
      p_invoice_number: invoiceNumber,
      p_student_id: studentId ?? null,
      p_amount: amount ?? 0,
      p_tax_amount: taxAmount ?? 0,
      p_due_date: dueDate ?? null,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getReceipts(
  invoiceId?: string,
  options: RequestOptions = {}
): Promise<Receipt[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_receipts', { p_invoice_id: invoiceId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    receipt_id: String(raw.receipt_id ?? ''),
    invoice_id: raw.invoice_id ? String(raw.invoice_id) : null,
    invoice_number: raw.invoice_number ? String(raw.invoice_number) : null,
    receipt_number: String(raw.receipt_number ?? ''),
    amount_paid: Number(raw.amount_paid ?? 0),
    payment_method: String(raw.payment_method ?? 'cash'),
    reference_number: raw.reference_number ? String(raw.reference_number) : null,
    paid_at: String(raw.paid_at ?? ''),
    recorded_by_name: raw.recorded_by_name ? String(raw.recorded_by_name) : null,
  }));
}

export async function recordReceipt(
  invoiceId: string,
  receiptNumber: string,
  amountPaid: number,
  paymentMethod?: string,
  referenceNumber?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('record_receipt', {
      p_invoice_id: invoiceId,
      p_receipt_number: receiptNumber,
      p_amount_paid: amountPaid,
      p_payment_method: paymentMethod ?? 'cash',
      p_reference_number: referenceNumber ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getWallet(
  ownerId: string,
  options: RequestOptions = {}
): Promise<Wallet> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_wallet', { p_owner_id: ownerId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  const payload = data as Record<string, unknown>;
  return {
    wallet_id: String(payload.wallet_id ?? ''),
    owner_id: String(payload.owner_id ?? ''),
    balance: Number(payload.balance ?? 0),
    currency: String(payload.currency ?? 'KES'),
    owner_type: String(payload.owner_type ?? 'student'),
  };
}

export async function createWalletTransaction(
  ownerId: string,
  transactionType: string,
  amount: number,
  description?: string,
  referenceNumber?: string,
  paymentMethod?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_wallet_transaction', {
      p_owner_id: ownerId,
      p_transaction_type: transactionType,
      p_amount: amount,
      p_description: description ?? null,
      p_reference_number: referenceNumber ?? null,
      p_payment_method: paymentMethod ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getWalletTransactions(
  ownerId: string,
  limit?: number,
  options: RequestOptions = {}
): Promise<WalletTransaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_wallet_transactions', { p_owner_id: ownerId, p_limit: limit ?? 50 })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    transaction_id: String(raw.transaction_id ?? ''),
    transaction_type: String(raw.transaction_type ?? ''),
    amount: Number(raw.amount ?? 0),
    balance_after: Number(raw.balance_after ?? 0),
    description: raw.description ? String(raw.description) : null,
    reference_number: raw.reference_number ? String(raw.reference_number) : null,
    payment_method: raw.payment_method ? String(raw.payment_method) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function getVoteHeads(
  options: RequestOptions = {}
): Promise<VoteHead[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_vote_heads')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    vote_head_id: String(raw.vote_head_id ?? ''),
    name: String(raw.name ?? ''),
    code: raw.code ? String(raw.code) : null,
    category_id: raw.category_id ? String(raw.category_id) : null,
    category_name: raw.category_name ? String(raw.category_name) : null,
    description: raw.description ? String(raw.description) : null,
    is_active: Boolean(raw.is_active),
  }));
}

export async function upsertVoteHead(
  name: string,
  code?: string,
  categoryId?: string,
  description?: string,
  voteHeadId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_vote_head', {
      p_name: name,
      p_code: code ?? null,
      p_category_id: categoryId ?? null,
      p_description: description ?? null,
      p_vote_head_id: voteHeadId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getVoteHeadCategories(
  options: RequestOptions = {}
): Promise<VoteHeadCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_vote_head_categories')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    category_id: String(raw.category_id ?? ''),
    name: String(raw.name ?? ''),
    description: raw.description ? String(raw.description) : null,
  }));
}

export async function getStudentVoteHeadBalances(
  studentId: string,
  options: RequestOptions = {}
): Promise<StudentVoteHeadBalance[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_vote_head_balances', { p_student_id: studentId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    vote_head_id: String(raw.vote_head_id ?? ''),
    vote_head_name: String(raw.vote_head_name ?? ''),
    vote_head_code: raw.vote_head_code ? String(raw.vote_head_code) : null,
    category_name: raw.category_name ? String(raw.category_name) : null,
    balance: Number(raw.balance ?? 0),
  }));
}

export async function recordFeeCollection(
  studentId: string,
  amount: number,
  collectionType?: string,
  voteHeadId?: string,
  paymentMethod?: string,
  referenceNumber?: string,
  academicYear?: number,
  term?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('record_fee_collection', {
      p_student_id: studentId,
      p_amount: amount,
      p_collection_type: collectionType ?? 'feeCollection',
      p_vote_head_id: voteHeadId ?? null,
      p_payment_method: paymentMethod ?? 'cash',
      p_reference_number: referenceNumber ?? null,
      p_academic_year: academicYear ?? null,
      p_term: term ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getFinanceOverview(
  academicYear?: number,
  term?: string,
  classId?: string,
  options: RequestOptions = {}
): Promise<Record<string, unknown>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_finance_overview', {
      p_academic_year: academicYear ?? null,
      p_term: term ?? null,
      p_class_id: classId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (data ?? {}) as Record<string, unknown>;
}

export async function getFinanceSummary(
  classId?: string,
  academicYear?: number,
  term?: string,
  startDate?: string,
  endDate?: string,
  options: RequestOptions = {}
): Promise<Record<string, unknown>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_finance_summary', {
      p_class_id: classId ?? null,
      p_academic_year: academicYear ?? null,
      p_term: term ?? null,
      p_start_date: startDate ?? null,
      p_end_date: endDate ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (data ?? {}) as Record<string, unknown>;
}

export async function getFeeCollections(
  studentId?: string,
  classId?: string,
  academicYear?: number,
  term?: string,
  startDate?: string,
  endDate?: string,
  sortBy?: string,
  sortDir?: string,
  limit?: number,
  options: RequestOptions = {}
): Promise<FeeCollection[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_collections', {
      p_student_id: studentId ?? null,
      p_class_id: classId ?? null,
      p_academic_year: academicYear ?? null,
      p_term: term ?? null,
      p_start_date: startDate ?? null,
      p_end_date: endDate ?? null,
      p_limit: limit ?? 50,
      p_sort_by: sortBy ?? 'collected_at',
      p_sort_dir: sortDir ?? 'desc',
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    collection_id: String(raw.collection_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    class_name: raw.class_name ? String(raw.class_name) : null,
    vote_head_name: raw.vote_head_name ? String(raw.vote_head_name) : null,
    amount: Number(raw.amount ?? 0),
    collection_type: String(raw.collection_type ?? 'feeCollection'),
    payment_method: raw.payment_method ? String(raw.payment_method) : null,
    reference_number: raw.reference_number ? String(raw.reference_number) : null,
    academic_year: raw.academic_year ? Number(raw.academic_year) : null,
    term: raw.term ? String(raw.term) : null,
    recorded_by_name: raw.recorded_by_name ? String(raw.recorded_by_name) : null,
    collected_at: String(raw.collected_at ?? ''),
  }));
}

export async function getReversalReasons(
  options: RequestOptions = {}
): Promise<ReversalReason[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_reversal_reasons')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    reason_id: String(raw.reason_id ?? ''),
    reason: String(raw.reason ?? ''),
    is_active: Boolean(raw.is_active),
  }));
}

export async function getFeeStructureGroups(
  options: RequestOptions = {}
): Promise<FeeStructureGroup[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_structure_groups')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    group_id: String(raw.group_id ?? ''),
    name: String(raw.name ?? ''),
    description: raw.description ? String(raw.description) : null,
  }));
}

export async function upsertFeeStructureGroup(
  name: string,
  description?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_fee_structure_group', {
      p_name: name,
      p_description: description ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getChartOfAccounts(
  options: RequestOptions = {}
): Promise<ChartOfAccount[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_chart_of_accounts')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    account_id: String(raw.account_id ?? ''),
    code: String(raw.code ?? ''),
    name: String(raw.name ?? ''),
    account_type: String(raw.account_type ?? ''),
    parent_id: raw.parent_id ? String(raw.parent_id) : null,
    parent_name: raw.parent_name ? String(raw.parent_name) : null,
    is_active: Boolean(raw.is_active),
    description: raw.description ? String(raw.description) : null,
  }));
}

export async function upsertChartOfAccount(
  code: string,
  name: string,
  accountType: string,
  parentId?: string,
  description?: string,
  accountId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_chart_of_account', {
      p_code: code,
      p_name: name,
      p_account_type: accountType,
      p_parent_id: parentId ?? null,
      p_description: description ?? null,
      p_account_id: accountId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function createJournalEntry(
  entryDate: string,
  description: string,
  reference?: string,
  sourceType?: string,
  sourceId?: string,
  lines?: Array<{ account_id: string; debit: number; credit: number; description?: string }>,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_journal_entry', {
      p_entry_date: entryDate,
      p_description: description,
      p_reference: reference ?? null,
      p_source_type: sourceType ?? null,
      p_source_id: sourceId ?? null,
      p_lines: lines ?? [],
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function postJournalEntry(
  entryId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('post_journal_entry', { p_entry_id: entryId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getTrialBalance(
  asOfDate?: string,
  options: RequestOptions = {}
): Promise<TrialBalanceRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_trial_balance', { p_as_of_date: asOfDate ?? new Date().toISOString().split('T')[0] })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    account_id: String(raw.account_id ?? ''),
    account_code: String(raw.account_code ?? ''),
    account_name: String(raw.account_name ?? ''),
    account_type: String(raw.account_type ?? ''),
    total_debit: Number(raw.total_debit ?? 0),
    total_credit: Number(raw.total_credit ?? 0),
    balance: Number(raw.balance ?? 0),
  }));
}

export async function recordCashBookEntry(
  entryType: string,
  amount: number,
  description: string,
  accountId?: string,
  referenceNumber?: string,
  paymentMethod?: string,
  entryDate?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('record_cash_book_entry', {
      p_entry_type: entryType,
      p_amount: amount,
      p_description: description,
      p_account_id: accountId ?? null,
      p_reference_number: referenceNumber ?? null,
      p_payment_method: paymentMethod ?? null,
      p_entry_date: entryDate ?? new Date().toISOString().split('T')[0],
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getCashBookEntries(
  limit?: number,
  options: RequestOptions = {}
): Promise<CashBookEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_cash_book_entries', { p_limit: limit ?? 50 })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    entry_id: String(raw.entry_id ?? ''),
    entry_date: String(raw.entry_date ?? ''),
    entry_type: String(raw.entry_type ?? ''),
    amount: Number(raw.amount ?? 0),
    description: String(raw.description ?? ''),
    account_code: raw.account_code ? String(raw.account_code) : null,
    account_name: raw.account_name ? String(raw.account_name) : null,
    reference_number: raw.reference_number ? String(raw.reference_number) : null,
    payment_method: raw.payment_method ? String(raw.payment_method) : null,
    recorded_by_name: raw.recorded_by_name ? String(raw.recorded_by_name) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function logAuditEvent(
  action: string,
  entityType: string,
  entityId?: string,
  beforeValues?: Record<string, unknown>,
  afterValues?: Record<string, unknown>,
  reason?: string,
  correlationId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('log_audit_event', {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId ?? null,
      p_before_values: beforeValues ?? null,
      p_after_values: afterValues ?? null,
      p_reason: reason ?? null,
      p_correlation_id: correlationId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getAuditEvents(
  entityType?: string,
  entityId?: string,
  action?: string,
  limit?: number,
  options: RequestOptions = {}
): Promise<AuditEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_audit_events', {
      p_entity_type: entityType ?? null,
      p_entity_id: entityId ?? null,
      p_action: action ?? null,
      p_limit: limit ?? 100,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    event_id: String(raw.event_id ?? ''),
    actor_id: raw.actor_id ? String(raw.actor_id) : null,
    actor_name: raw.actor_name ? String(raw.actor_name) : null,
    action: String(raw.action ?? ''),
    entity_type: String(raw.entity_type ?? ''),
    entity_id: raw.entity_id ? String(raw.entity_id) : null,
    before_values: raw.before_values ? (raw.before_values as Record<string, unknown>) : null,
    after_values: raw.after_values ? (raw.after_values as Record<string, unknown>) : null,
    reason: raw.reason ? String(raw.reason) : null,
    correlation_id: raw.correlation_id ? String(raw.correlation_id) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function submitFeeWaiver(
  studentId: string,
  amount: number,
  reason: string,
  invoiceId?: string,
  supportingReference?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('submit_fee_waiver', {
      p_student_id: studentId,
      p_amount: amount,
      p_reason: reason,
      p_invoice_id: invoiceId ?? null,
      p_supporting_reference: supportingReference ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function approveFeeWaiver(
  waiverId: string,
  reviewNotes?: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('approve_fee_waiver', {
      p_waiver_id: waiverId,
      p_review_notes: reviewNotes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function rejectFeeWaiver(
  waiverId: string,
  reviewNotes?: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('reject_fee_waiver', {
      p_waiver_id: waiverId,
      p_review_notes: reviewNotes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function cancelFeeWaiver(
  waiverId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('cancel_fee_waiver', { p_waiver_id: waiverId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getFeeWaivers(
  status?: string,
  studentId?: string,
  options: RequestOptions = {}
): Promise<FeeWaiver[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_waivers', { p_status: status ?? null, p_student_id: studentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    waiver_id: String(raw.waiver_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    invoice_id: raw.invoice_id ? String(raw.invoice_id) : null,
    amount: Number(raw.amount ?? 0),
    reason: String(raw.reason ?? ''),
    supporting_reference: raw.supporting_reference ? String(raw.supporting_reference) : null,
    status: String(raw.status ?? 'pending'),
    requested_by_name: raw.requested_by_name ? String(raw.requested_by_name) : null,
    requested_at: String(raw.requested_at ?? ''),
    reviewed_by_name: raw.reviewed_by_name ? String(raw.reviewed_by_name) : null,
    reviewed_at: raw.reviewed_at ? String(raw.reviewed_at) : null,
    review_notes: raw.review_notes ? String(raw.review_notes) : null,
    applied_at: raw.applied_at ? String(raw.applied_at) : null,
  }));
}

export async function getFiscalPeriods(
  options: RequestOptions = {}
): Promise<FiscalPeriod[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fiscal_periods')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    period_id: String(raw.period_id ?? ''),
    name: String(raw.name ?? ''),
    start_date: String(raw.start_date ?? ''),
    end_date: String(raw.end_date ?? ''),
    status: String(raw.status ?? 'open'),
    closed_by_name: raw.closed_by_name ? String(raw.closed_by_name) : null,
    closed_at: raw.closed_at ? String(raw.closed_at) : null,
    close_reason: raw.close_reason ? String(raw.close_reason) : null,
    reopened_by_name: raw.reopened_by_name ? String(raw.reopened_by_name) : null,
    reopened_at: raw.reopened_at ? String(raw.reopened_at) : null,
    reopen_reason: raw.reopen_reason ? String(raw.reopen_reason) : null,
  }));
}

export async function createFiscalPeriod(
  name: string,
  startDate: string,
  endDate: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_fiscal_period', {
      p_name: name,
      p_start_date: startDate,
      p_end_date: endDate,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function closeFiscalPeriod(
  periodId: string,
  reason?: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('close_fiscal_period', {
      p_period_id: periodId,
      p_reason: reason ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function reopenFiscalPeriod(
  periodId: string,
  reason: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('reopen_fiscal_period', {
      p_period_id: periodId,
      p_reason: reason,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function isPeriodLocked(
  date: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('is_period_locked', { p_date: date })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getBudgets(
  status?: string,
  options: RequestOptions = {}
): Promise<Budget[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_budgets', { p_status: status ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    budget_id: String(raw.budget_id ?? ''),
    name: String(raw.name ?? ''),
    fiscal_period_id: raw.fiscal_period_id ? String(raw.fiscal_period_id) : null,
    fiscal_period_name: raw.fiscal_period_name ? String(raw.fiscal_period_name) : null,
    status: String(raw.status ?? 'draft'),
    version: Number(raw.version ?? 1),
    created_by_name: raw.created_by_name ? String(raw.created_by_name) : null,
    approved_by_name: raw.approved_by_name ? String(raw.approved_by_name) : null,
    approved_at: raw.approved_at ? String(raw.approved_at) : null,
    created_at: String(raw.created_at ?? ''),
    line_count: Number(raw.line_count ?? 0),
    total_budget: Number(raw.total_budget ?? 0),
  }));
}

export async function createBudget(
  name: string,
  fiscalPeriodId?: string,
  description?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_budget', {
      p_name: name,
      p_fiscal_period_id: fiscalPeriodId ?? null,
      p_description: description ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function addBudgetLine(
  budgetId: string,
  accountId?: string,
  voteHeadId?: string,
  budgetType?: string,
  amount?: number,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_budget_line', {
      p_budget_id: budgetId,
      p_account_id: accountId ?? null,
      p_vote_head_id: voteHeadId ?? null,
      p_budget_type: budgetType ?? 'expenditure',
      p_amount: amount ?? 0,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function approveBudget(
  budgetId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('approve_budget', { p_budget_id: budgetId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getBudgetVsActual(
  budgetId: string,
  startDate?: string,
  endDate?: string,
  options: RequestOptions = {}
): Promise<BudgetVsActual[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_budget_vs_actual', {
      p_budget_id: budgetId,
      p_start_date: startDate ?? null,
      p_end_date: endDate ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    line_id: String(raw.line_id ?? ''),
    account_id: raw.account_id ? String(raw.account_id) : null,
    account_code: raw.account_code ? String(raw.account_code) : null,
    account_name: raw.account_name ? String(raw.account_name) : null,
    vote_head_id: raw.vote_head_id ? String(raw.vote_head_id) : null,
    vote_head_name: raw.vote_head_name ? String(raw.vote_head_name) : null,
    budget_type: String(raw.budget_type ?? 'expenditure'),
    budget_amount: Number(raw.budget_amount ?? 0),
    actual_amount: Number(raw.actual_amount ?? 0),
    variance: Number(raw.variance ?? 0),
    variance_pct: raw.variance_pct != null ? Number(raw.variance_pct) : null,
  }));
}

export async function getDailyAttendance(
  date: string,
  classId?: string,
  streamId?: string,
  options: RequestOptions = {}
): Promise<DailyAttendanceRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_daily_attendance', { p_date: date, p_class_id: classId ?? null, p_stream_id: streamId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    class_name: raw.class_name ? String(raw.class_name) : null,
    stream_name: raw.stream_name ? String(raw.stream_name) : null,
    status: String(raw.status ?? 'present'),
    absence_reason: raw.absence_reason ? String(raw.absence_reason) : null,
    arrival_time: raw.arrival_time ? String(raw.arrival_time) : null,
    remarks: raw.remarks ? String(raw.remarks) : null,
    recorded_at: raw.recorded_at ? String(raw.recorded_at) : null,
  }));
}

export async function saveDailyAttendance(
  date: string,
  entries: Array<{ student_id: string; status: string; absence_reason?: string; arrival_time?: string; remarks?: string }>,
  options: RequestOptions = {}
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('save_daily_attendance', { p_attendance_date: date, p_entries: entries })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Number(data ?? 0);
}

export async function getAttendanceSummary(
  startDate: string,
  endDate: string,
  classId?: string,
  options: RequestOptions = {}
): Promise<AttendanceSummaryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_attendance_summary', { p_start_date: startDate, p_end_date: endDate, p_class_id: classId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    total_days: Number(raw.total_days ?? 0),
    present_days: Number(raw.present_days ?? 0),
    absent_days: Number(raw.absent_days ?? 0),
    late_days: Number(raw.late_days ?? 0),
    excused_days: Number(raw.excused_days ?? 0),
    sick_days: Number(raw.sick_days ?? 0),
    attendance_pct: Number(raw.attendance_pct ?? 0),
  }));
}

export async function getEmergencyContacts(
  studentId: string,
  options: RequestOptions = {}
): Promise<EmergencyContact[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_emergency_contacts', { p_student_id: studentId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    contact_id: String(raw.contact_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    full_name: String(raw.full_name ?? ''),
    relationship: String(raw.relationship ?? ''),
    phone_primary: String(raw.phone_primary ?? ''),
    phone_secondary: raw.phone_secondary ? String(raw.phone_secondary) : null,
    email: raw.email ? String(raw.email) : null,
    is_primary: Boolean(raw.is_primary),
    is_authorized_pickup: Boolean(raw.is_authorized_pickup),
    notes: raw.notes ? String(raw.notes) : null,
  }));
}

export async function upsertEmergencyContact(
  studentId: string,
  fullName: string,
  relationship: string,
  phonePrimary: string,
  phoneSecondary?: string,
  email?: string,
  isPrimary?: boolean,
  isAuthorizedPickup?: boolean,
  notes?: string,
  contactId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_emergency_contact', {
      p_student_id: studentId,
      p_full_name: fullName,
      p_relationship: relationship,
      p_phone_primary: phonePrimary,
      p_phone_secondary: phoneSecondary ?? null,
      p_email: email ?? null,
      p_is_primary: isPrimary ?? false,
      p_is_authorized_pickup: isAuthorizedPickup ?? false,
      p_notes: notes ?? null,
      p_contact_id: contactId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getMedicalAlerts(
  studentId: string,
  options: RequestOptions = {}
): Promise<MedicalAlert[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_medical_alerts', { p_student_id: studentId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    alert_id: String(raw.alert_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    alert_type: String(raw.alert_type ?? ''),
    description: String(raw.description ?? ''),
    severity: String(raw.severity ?? 'medium'),
    instructions: raw.instructions ? String(raw.instructions) : null,
    is_active: Boolean(raw.is_active),
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function upsertMedicalAlert(
  studentId: string,
  alertType: string,
  description: string,
  severity?: string,
  instructions?: string,
  isActive?: boolean,
  alertId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_medical_alert', {
      p_student_id: studentId,
      p_alert_type: alertType,
      p_description: description,
      p_severity: severity ?? 'medium',
      p_instructions: instructions ?? null,
      p_is_active: isActive ?? true,
      p_alert_id: alertId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getLeaveTypes(
  options: RequestOptions = {}
): Promise<LeaveType[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_leave_types')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    leave_type_id: String(raw.leave_type_id ?? ''),
    name: String(raw.name ?? ''),
    description: raw.description ? String(raw.description) : null,
    max_days_per_year: raw.max_days_per_year != null ? Number(raw.max_days_per_year) : null,
    is_paid: Boolean(raw.is_paid),
    is_active: Boolean(raw.is_active),
  }));
}

export async function createLeaveType(
  name: string,
  description?: string,
  maxDaysPerYear?: number,
  isPaid?: boolean,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_leave_type', {
      p_name: name,
      p_description: description ?? null,
      p_max_days_per_year: maxDaysPerYear ?? null,
      p_is_paid: isPaid ?? true,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function submitLeaveRequest(
  leaveTypeId: string,
  startDate: string,
  endDate: string,
  reason?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('submit_leave_request', {
      p_leave_type_id: leaveTypeId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_reason: reason ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function approveLeaveRequest(
  requestId: string,
  reviewNotes?: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('approve_leave_request', {
      p_request_id: requestId,
      p_review_notes: reviewNotes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function rejectLeaveRequest(
  requestId: string,
  rejectionReason?: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('reject_leave_request', {
      p_request_id: requestId,
      p_rejection_reason: rejectionReason ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getLeaveRequests(
  status?: string,
  staffId?: string,
  options: RequestOptions = {}
): Promise<LeaveRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_leave_requests', { p_status: status ?? null, p_staff_id: staffId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    request_id: String(raw.request_id ?? ''),
    staff_id: String(raw.staff_id ?? ''),
    staff_name: raw.staff_name ? String(raw.staff_name) : null,
    leave_type_id: String(raw.leave_type_id ?? ''),
    leave_type_name: String(raw.leave_type_name ?? ''),
    start_date: String(raw.start_date ?? ''),
    end_date: String(raw.end_date ?? ''),
    days_requested: Number(raw.days_requested ?? 0),
    reason: raw.reason ? String(raw.reason) : null,
    status: String(raw.status ?? 'pending'),
    approved_by_name: raw.approved_by_name ? String(raw.approved_by_name) : null,
    approved_at: raw.approved_at ? String(raw.approved_at) : null,
    rejection_reason: raw.rejection_reason ? String(raw.rejection_reason) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function getDutyRosters(
  options: RequestOptions = {}
): Promise<DutyRoster[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_duty_rosters')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    roster_id: String(raw.roster_id ?? ''),
    duty_type: String(raw.duty_type ?? ''),
    description: raw.description ? String(raw.description) : null,
    start_date: String(raw.start_date ?? ''),
    end_date: String(raw.end_date ?? ''),
    assignment_count: Number(raw.assignment_count ?? 0),
  }));
}

export async function createDutyRoster(
  dutyType: string,
  startDate: string,
  endDate: string,
  description?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_duty_roster', {
      p_duty_type: dutyType,
      p_start_date: startDate,
      p_end_date: endDate,
      p_description: description ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getDutyAssignments(
  rosterId: string,
  options: RequestOptions = {}
): Promise<DutyAssignment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_duty_assignments', { p_roster_id: rosterId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    assignment_id: String(raw.assignment_id ?? ''),
    staff_id: String(raw.staff_id ?? ''),
    staff_name: raw.staff_name ? String(raw.staff_name) : null,
    duty_date: String(raw.duty_date ?? ''),
    duty_period: raw.duty_period ? String(raw.duty_period) : null,
    notes: raw.notes ? String(raw.notes) : null,
  }));
}

export async function assignDuty(
  rosterId: string,
  staffId: string,
  dutyDate: string,
  dutyPeriod?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('assign_duty', {
      p_roster_id: rosterId,
      p_staff_id: staffId,
      p_duty_date: dutyDate,
      p_duty_period: dutyPeriod ?? null,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getSubstitutions(
  date?: string,
  options: RequestOptions = {}
): Promise<Substitution[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_substitutions', { p_date: date ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    substitution_id: String(raw.substitution_id ?? ''),
    original_staff_id: String(raw.original_staff_id ?? ''),
    original_staff_name: raw.original_staff_name ? String(raw.original_staff_name) : null,
    substitute_staff_id: String(raw.substitute_staff_id ?? ''),
    substitute_staff_name: raw.substitute_staff_name ? String(raw.substitute_staff_name) : null,
    timetable_entry_id: raw.timetable_entry_id ? String(raw.timetable_entry_id) : null,
    substitution_date: String(raw.substitution_date ?? ''),
    reason: raw.reason ? String(raw.reason) : null,
    status: String(raw.status ?? 'pending'),
  }));
}

export async function createSubstitution(
  originalStaffId: string,
  substituteStaffId: string,
  substitutionDate: string,
  timetableEntryId?: string,
  reason?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_substitution', {
      p_original_staff_id: originalStaffId,
      p_substitute_staff_id: substituteStaffId,
      p_substitution_date: substitutionDate,
      p_timetable_entry_id: timetableEntryId ?? null,
      p_reason: reason ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
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

export async function getTeacherWorkload(
  options: RequestOptions = {}
): Promise<TeacherWorkload[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_teacher_workload')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    teacher_id: String(raw.teacher_id ?? ''),
    teacher_name: raw.teacher_name ? String(raw.teacher_name) : null,
    total_periods: Number(raw.total_periods ?? 0),
    total_hours: Number(raw.total_hours ?? 0),
    subject_count: Number(raw.subject_count ?? 0),
    class_count: Number(raw.class_count ?? 0),
    duty_count: Number(raw.duty_count ?? 0),
    substitution_count: Number(raw.substitution_count ?? 0),
  }));
}

export async function getPayrollPeriods(
  options: RequestOptions = {}
): Promise<PayrollPeriod[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_payroll_periods')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    period_id: String(raw.period_id ?? ''),
    name: String(raw.name ?? ''),
    start_date: String(raw.start_date ?? ''),
    end_date: String(raw.end_date ?? ''),
    status: String(raw.status ?? 'draft'),
    created_by_name: raw.created_by_name ? String(raw.created_by_name) : null,
    approved_by_name: raw.approved_by_name ? String(raw.approved_by_name) : null,
    approved_at: raw.approved_at ? String(raw.approved_at) : null,
    finalized_at: raw.finalized_at ? String(raw.finalized_at) : null,
    entry_count: Number(raw.entry_count ?? 0),
  }));
}

export async function createPayrollPeriod(
  name: string,
  startDate: string,
  endDate: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_payroll_period', {
      p_name: name,
      p_start_date: startDate,
      p_end_date: endDate,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getPayrollEntries(
  periodId: string,
  options: RequestOptions = {}
): Promise<PayrollEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_payroll_entries', { p_period_id: periodId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    entry_id: String(raw.entry_id ?? ''),
    staff_id: String(raw.staff_id ?? ''),
    staff_name: raw.staff_name ? String(raw.staff_name) : null,
    basic_salary: Number(raw.basic_salary ?? 0),
    gross_earnings: Number(raw.gross_earnings ?? 0),
    total_deductions: Number(raw.total_deductions ?? 0),
    net_pay: Number(raw.net_pay ?? 0),
    employer_contributions: Number(raw.employer_contributions ?? 0),
    paye: Number(raw.paye ?? 0),
    nssf_employee: Number(raw.nssf_employee ?? 0),
    nssf_employer: Number(raw.nssf_employer ?? 0),
    sha_employee: Number(raw.sha_employee ?? 0),
    ahl_employee: Number(raw.ahl_employee ?? 0),
    ahl_employer: Number(raw.ahl_employer ?? 0),
    status: String(raw.status ?? 'draft'),
  }));
}

export async function generatePayroll(
  periodId: string,
  options: RequestOptions = {}
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('generate_payroll', { p_period_id: periodId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Number(data ?? 0);
}

export async function approvePayroll(
  periodId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('approve_payroll', { p_period_id: periodId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function finalizePayroll(
  periodId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('finalize_payroll', { p_period_id: periodId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getSalaryComponents(
  options: RequestOptions = {}
): Promise<SalaryComponent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_salary_components')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    component_id: String(raw.component_id ?? ''),
    name: String(raw.name ?? ''),
    component_type: String(raw.component_type ?? ''),
    calculation_type: String(raw.calculation_type ?? 'fixed'),
    default_amount: raw.default_amount != null ? Number(raw.default_amount) : null,
    percentage_rate: raw.percentage_rate != null ? Number(raw.percentage_rate) : null,
    is_taxable: Boolean(raw.is_taxable),
    is_pensionable: Boolean(raw.is_pensionable),
    statutory_type: raw.statutory_type ? String(raw.statutory_type) : null,
    effective_from: String(raw.effective_from ?? ''),
    effective_to: raw.effective_to ? String(raw.effective_to) : null,
    is_active: Boolean(raw.is_active),
  }));
}

export async function upsertSalaryComponent(
  name: string,
  componentType: string,
  calculationType?: string,
  defaultAmount?: number,
  percentageRate?: number,
  isTaxable?: boolean,
  isPensionable?: boolean,
  statutoryType?: string,
  effectiveFrom?: string,
  effectiveTo?: string,
  isActive?: boolean,
  componentId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_salary_component', {
      p_name: name,
      p_component_type: componentType,
      p_calculation_type: calculationType ?? 'fixed',
      p_default_amount: defaultAmount ?? null,
      p_percentage_rate: percentageRate ?? null,
      p_is_taxable: isTaxable ?? true,
      p_is_pensionable: isPensionable ?? true,
      p_statutory_type: statutoryType ?? 'none',
      p_effective_from: effectiveFrom ?? new Date().toISOString().split('T')[0],
      p_effective_to: effectiveTo ?? null,
      p_is_active: isActive ?? true,
      p_component_id: componentId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getEmployeeSalaries(
  staffId?: string,
  options: RequestOptions = {}
): Promise<EmployeeSalary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_employee_salaries', { p_staff_id: staffId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    salary_id: String(raw.salary_id ?? ''),
    staff_id: String(raw.staff_id ?? ''),
    staff_name: raw.staff_name ? String(raw.staff_name) : null,
    basic_salary: Number(raw.basic_salary ?? 0),
    effective_from: String(raw.effective_from ?? ''),
    effective_to: raw.effective_to ? String(raw.effective_to) : null,
    is_active: Boolean(raw.is_active),
    component_count: Number(raw.component_count ?? 0),
  }));
}

export async function upsertEmployeeSalary(
  staffId: string,
  basicSalary: number,
  effectiveFrom?: string,
  effectiveTo?: string,
  isActive?: boolean,
  salaryId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_employee_salary', {
      p_staff_id: staffId,
      p_basic_salary: basicSalary,
      p_effective_from: effectiveFrom ?? new Date().toISOString().split('T')[0],
      p_effective_to: effectiveTo ?? null,
      p_is_active: isActive ?? true,
      p_salary_id: salaryId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getDataRetentionPolicies(
  options: RequestOptions = {}
): Promise<DataRetentionPolicy[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_data_retention_policies')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    policy_id: String(raw.policy_id ?? ''),
    entity_type: String(raw.entity_type ?? ''),
    retention_days: Number(raw.retention_days ?? 365),
    action: String(raw.action ?? 'archive'),
    is_active: Boolean(raw.is_active),
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function upsertDataRetentionPolicy(
  entityType: string,
  retentionDays: number,
  action?: string,
  isActive?: boolean,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_data_retention_policy', {
      p_entity_type: entityType,
      p_retention_days: retentionDays,
      p_action: action ?? 'archive',
      p_is_active: isActive ?? true,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getLibraryBooks(
  search?: string,
  options: RequestOptions = {}
): Promise<LibraryBook[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_library_books', { p_search: search ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    book_id: String(raw.book_id ?? ''),
    title: String(raw.title ?? ''),
    author: raw.author ? String(raw.author) : null,
    isbn: raw.isbn ? String(raw.isbn) : null,
    category: raw.category ? String(raw.category) : null,
    publisher: raw.publisher ? String(raw.publisher) : null,
    publication_year: raw.publication_year != null ? Number(raw.publication_year) : null,
    total_copies: Number(raw.total_copies ?? 1),
    available_copies: Number(raw.available_copies ?? 0),
    location: raw.location ? String(raw.location) : null,
    is_active: Boolean(raw.is_active),
  }));
}

export async function addLibraryBook(
  title: string,
  author?: string,
  isbn?: string,
  category?: string,
  publisher?: string,
  publicationYear?: number,
  totalCopies?: number,
  location?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_library_book', {
      p_title: title,
      p_author: author ?? null,
      p_isbn: isbn ?? null,
      p_category: category ?? null,
      p_publisher: publisher ?? null,
      p_publication_year: publicationYear ?? null,
      p_total_copies: totalCopies ?? 1,
      p_location: location ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function borrowBook(
  bookId: string,
  borrowerId: string,
  borrowerType?: string,
  dueDate?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('borrow_book', {
      p_book_id: bookId,
      p_borrower_id: borrowerId,
      p_borrower_type: borrowerType ?? 'student',
      p_due_date: dueDate ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function returnBook(
  loanId: string,
  fineAmount?: number,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('return_book', {
      p_loan_id: loanId,
      p_fine_amount: fineAmount ?? 0,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getBookLoans(
  status?: string,
  borrowerId?: string,
  options: RequestOptions = {}
): Promise<BookLoan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_book_loans', { p_status: status ?? null, p_borrower_id: borrowerId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    loan_id: String(raw.loan_id ?? ''),
    book_id: String(raw.book_id ?? ''),
    book_title: raw.book_title ? String(raw.book_title) : null,
    borrower_id: String(raw.borrower_id ?? ''),
    borrower_name: raw.borrower_name ? String(raw.borrower_name) : null,
    borrower_type: String(raw.borrower_type ?? 'student'),
    loan_date: String(raw.loan_date ?? ''),
    due_date: String(raw.due_date ?? ''),
    return_date: raw.return_date ? String(raw.return_date) : null,
    status: String(raw.status ?? 'borrowed'),
    fine_amount: Number(raw.fine_amount ?? 0),
    fine_paid: Boolean(raw.fine_paid),
    is_overdue: Boolean(raw.is_overdue),
  }));
}

export async function getVehicles(
  options: RequestOptions = {}
): Promise<Vehicle[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_vehicles')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    vehicle_id: String(raw.vehicle_id ?? ''),
    registration_number: String(raw.registration_number ?? ''),
    vehicle_type: String(raw.vehicle_type ?? 'bus'),
    capacity: Number(raw.capacity ?? 0),
    make: raw.make ? String(raw.make) : null,
    model: raw.model ? String(raw.model) : null,
    year: raw.year != null ? Number(raw.year) : null,
    is_active: Boolean(raw.is_active),
  }));
}

export async function addVehicle(
  registrationNumber: string,
  vehicleType?: string,
  capacity?: number,
  make?: string,
  model?: string,
  year?: number,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_vehicle', {
      p_registration_number: registrationNumber,
      p_vehicle_type: vehicleType ?? 'bus',
      p_capacity: capacity ?? 0,
      p_make: make ?? null,
      p_model: model ?? null,
      p_year: year ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getTransportRoutes(
  options: RequestOptions = {}
): Promise<TransportRoute[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_transport_routes')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    route_id: String(raw.route_id ?? ''),
    name: String(raw.name ?? ''),
    description: raw.description ? String(raw.description) : null,
    vehicle_id: raw.vehicle_id ? String(raw.vehicle_id) : null,
    registration_number: raw.registration_number ? String(raw.registration_number) : null,
    driver_id: raw.driver_id ? String(raw.driver_id) : null,
    driver_name: raw.driver_name ? String(raw.driver_name) : null,
    pickup_points: raw.pickup_points ? String(raw.pickup_points) : null,
    departure_time: raw.departure_time ? String(raw.departure_time) : null,
    return_time: raw.return_time ? String(raw.return_time) : null,
    is_active: Boolean(raw.is_active),
    student_count: Number(raw.student_count ?? 0),
  }));
}

export async function createTransportRoute(
  name: string,
  description?: string,
  vehicleId?: string,
  driverId?: string,
  pickupPoints?: string,
  departureTime?: string,
  returnTime?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_transport_route', {
      p_name: name,
      p_description: description ?? null,
      p_vehicle_id: vehicleId ?? null,
      p_driver_id: driverId ?? null,
      p_pickup_points: pickupPoints ?? null,
      p_departure_time: departureTime ?? null,
      p_return_time: returnTime ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getStudentTransport(
  studentId?: string,
  options: RequestOptions = {}
): Promise<StudentTransport[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_transport', { p_student_id: studentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    assignment_id: String(raw.assignment_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    route_id: String(raw.route_id ?? ''),
    route_name: raw.route_name ? String(raw.route_name) : null,
    pickup_point: raw.pickup_point ? String(raw.pickup_point) : null,
    is_active: Boolean(raw.is_active),
  }));
}

export async function assignStudentTransport(
  studentId: string,
  routeId: string,
  pickupPoint?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('assign_student_transport', {
      p_student_id: studentId,
      p_route_id: routeId,
      p_pickup_point: pickupPoint ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getMealPlans(
  residenceId?: string,
  date?: string,
  options: RequestOptions = {}
): Promise<MealPlan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_meal_plans', { p_residence_id: residenceId ?? null, p_date: date ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    plan_id: String(raw.plan_id ?? ''),
    residence_id: raw.residence_id ? String(raw.residence_id) : null,
    residence_name: raw.residence_name ? String(raw.residence_name) : null,
    meal_date: String(raw.meal_date ?? ''),
    meal_type: String(raw.meal_type ?? ''),
    menu: raw.menu ? String(raw.menu) : null,
    present_count: Number(raw.present_count ?? 0),
    absent_count: Number(raw.absent_count ?? 0),
  }));
}

export async function createMealPlan(
  residenceId: string,
  mealDate: string,
  mealType: string,
  menu?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_meal_plan', {
      p_residence_id: residenceId,
      p_meal_date: mealDate,
      p_meal_type: mealType,
      p_menu: menu ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function saveMealAttendance(
  mealPlanId: string,
  entries: Array<{ student_id: string; status: string }>,
  options: RequestOptions = {}
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('save_meal_attendance', { p_meal_plan_id: mealPlanId, p_entries: entries })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Number(data ?? 0);
}

export async function getBoardingRollCalls(
  residenceId?: string,
  date?: string,
  options: RequestOptions = {}
): Promise<BoardingRollCall[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_boarding_roll_calls', { p_residence_id: residenceId ?? null, p_date: date ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    roll_call_id: String(raw.roll_call_id ?? ''),
    residence_id: String(raw.residence_id ?? ''),
    residence_name: raw.residence_name ? String(raw.residence_name) : null,
    roll_call_date: String(raw.roll_call_date ?? ''),
    roll_call_time: String(raw.roll_call_time ?? ''),
    roll_call_type: String(raw.roll_call_type ?? 'evening'),
    present_count: Number(raw.present_count ?? 0),
    absent_count: Number(raw.absent_count ?? 0),
    total_count: Number(raw.total_count ?? 0),
  }));
}

export async function createBoardingRollCall(
  residenceId: string,
  rollCallDate: string,
  rollCallTime?: string,
  rollCallType?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_boarding_roll_call', {
      p_residence_id: residenceId,
      p_roll_call_date: rollCallDate,
      p_roll_call_time: rollCallTime ?? '21:00',
      p_roll_call_type: rollCallType ?? 'evening',
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function saveBoardingRollCallEntries(
  rollCallId: string,
  entries: Array<{ student_id: string; status: string; remarks?: string }>,
  options: RequestOptions = {}
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('save_boarding_roll_call_entries', { p_roll_call_id: rollCallId, p_entries: entries })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Number(data ?? 0);
}

export async function getBoardingRollCallEntries(
  rollCallId: string,
  options: RequestOptions = {}
): Promise<Array<{ entry_id: string; student_id: string; student_name: string | null; admission_no: string; status: string; remarks: string | null }>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_boarding_roll_call_entries', { p_roll_call_id: rollCallId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    entry_id: String(raw.entry_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    status: String(raw.status ?? 'present'),
    remarks: raw.remarks ? String(raw.remarks) : null,
  }));
}

export async function getSports(
  options: RequestOptions = {}
): Promise<Sport[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_sports')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    sport_id: String(raw.sport_id ?? ''),
    name: String(raw.name ?? ''),
    description: raw.description ? String(raw.description) : null,
    sport_type: String(raw.sport_type ?? 'sport'),
    is_active: Boolean(raw.is_active),
    event_count: Number(raw.event_count ?? 0),
  }));
}

export async function createSport(
  name: string,
  description?: string,
  sportType?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_sport', {
      p_name: name,
      p_description: description ?? null,
      p_sport_type: sportType ?? 'sport',
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getSportsEvents(
  sportId?: string,
  options: RequestOptions = {}
): Promise<SportsEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_sports_events', { p_sport_id: sportId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    event_id: String(raw.event_id ?? ''),
    sport_id: raw.sport_id ? String(raw.sport_id) : null,
    sport_name: raw.sport_name ? String(raw.sport_name) : null,
    title: String(raw.title ?? ''),
    event_date: String(raw.event_date ?? ''),
    event_type: String(raw.event_type ?? 'match'),
    venue: raw.venue ? String(raw.venue) : null,
    opponent: raw.opponent ? String(raw.opponent) : null,
    result: raw.result ? String(raw.result) : null,
    score: raw.score ? String(raw.score) : null,
    participant_count: Number(raw.participant_count ?? 0),
  }));
}

export async function createSportsEvent(
  title: string,
  eventDate: string,
  sportId?: string,
  eventType?: string,
  venue?: string,
  opponent?: string,
  result?: string,
  score?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_sports_event', {
      p_title: title,
      p_event_date: eventDate,
      p_sport_id: sportId ?? null,
      p_event_type: eventType ?? 'match',
      p_venue: venue ?? null,
      p_opponent: opponent ?? null,
      p_result: result ?? null,
      p_score: score ?? null,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getSportsParticipation(
  eventId: string,
  options: RequestOptions = {}
): Promise<SportsParticipation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_sports_participation', { p_event_id: eventId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    participation_id: String(raw.participation_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    role: String(raw.role ?? 'player'),
    performance_notes: raw.performance_notes ? String(raw.performance_notes) : null,
  }));
}

export async function addSportsParticipation(
  eventId: string,
  studentId: string,
  role?: string,
  performanceNotes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_sports_participation', {
      p_event_id: eventId,
      p_student_id: studentId,
      p_role: role ?? 'player',
      p_performance_notes: performanceNotes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getTrips(
  status?: string,
  options: RequestOptions = {}
): Promise<Trip[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_trips', { p_status: status ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    trip_id: String(raw.trip_id ?? ''),
    title: String(raw.title ?? ''),
    description: raw.description ? String(raw.description) : null,
    trip_type: String(raw.trip_type ?? 'educational'),
    destination: String(raw.destination ?? ''),
    start_date: String(raw.start_date ?? ''),
    end_date: String(raw.end_date ?? ''),
    departure_time: raw.departure_time ? String(raw.departure_time) : null,
    return_time: raw.return_time ? String(raw.return_time) : null,
    transport_mode: raw.transport_mode ? String(raw.transport_mode) : null,
    estimated_cost: raw.estimated_cost != null ? Number(raw.estimated_cost) : null,
    actual_cost: raw.actual_cost != null ? Number(raw.actual_cost) : null,
    status: String(raw.status ?? 'planned'),
    participant_count: Number(raw.participant_count ?? 0),
    permission_slip_count: Number(raw.permission_slip_count ?? 0),
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function createTrip(
  title: string,
  destination: string,
  startDate: string,
  endDate: string,
  tripType?: string,
  description?: string,
  departureTime?: string,
  returnTime?: string,
  transportMode?: string,
  estimatedCost?: number,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_trip', {
      p_title: title,
      p_destination: destination,
      p_start_date: startDate,
      p_end_date: endDate,
      p_trip_type: tripType ?? 'educational',
      p_description: description ?? null,
      p_departure_time: departureTime ?? null,
      p_return_time: returnTime ?? null,
      p_transport_mode: transportMode ?? null,
      p_estimated_cost: estimatedCost ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getTripParticipants(
  tripId: string,
  options: RequestOptions = {}
): Promise<TripParticipant[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_trip_participants', { p_trip_id: tripId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    participant_id: String(raw.participant_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    permission_slip_signed: Boolean(raw.permission_slip_signed),
    permission_slip_date: raw.permission_slip_date ? String(raw.permission_slip_date) : null,
    payment_status: String(raw.payment_status ?? 'pending'),
    amount_paid: Number(raw.amount_paid ?? 0),
    notes: raw.notes ? String(raw.notes) : null,
  }));
}

export async function addTripParticipant(
  tripId: string,
  studentId: string,
  permissionSlipSigned?: boolean,
  permissionSlipDate?: string,
  paymentStatus?: string,
  amountPaid?: number,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_trip_participant', {
      p_trip_id: tripId,
      p_student_id: studentId,
      p_permission_slip_signed: permissionSlipSigned ?? false,
      p_permission_slip_date: permissionSlipDate ?? null,
      p_payment_status: paymentStatus ?? 'pending',
      p_amount_paid: amountPaid ?? 0,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function updateTripStatus(
  tripId: string,
  status: string,
  actualCost?: number,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('update_trip_status', {
      p_trip_id: tripId,
      p_status: status,
      p_actual_cost: actualCost ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getBankStatements(
  options: RequestOptions = {}
): Promise<BankStatement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_bank_statements')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    statement_id: String(raw.statement_id ?? ''),
    account_name: String(raw.account_name ?? ''),
    bank_name: raw.bank_name ? String(raw.bank_name) : null,
    statement_date: String(raw.statement_date ?? ''),
    opening_balance: Number(raw.opening_balance ?? 0),
    closing_balance: Number(raw.closing_balance ?? 0),
    file_name: raw.file_name ? String(raw.file_name) : null,
    status: String(raw.status ?? 'imported'),
    imported_by_name: raw.imported_by_name ? String(raw.imported_by_name) : null,
    imported_at: String(raw.imported_at ?? ''),
    line_count: Number(raw.line_count ?? 0),
    matched_count: Number(raw.matched_count ?? 0),
    unmatched_count: Number(raw.unmatched_count ?? 0),
  }));
}

export async function createBankStatement(
  accountName: string,
  statementDate: string,
  bankName?: string,
  openingBalance?: number,
  closingBalance?: number,
  fileName?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_bank_statement', {
      p_account_name: accountName,
      p_statement_date: statementDate,
      p_bank_name: bankName ?? null,
      p_opening_balance: openingBalance ?? 0,
      p_closing_balance: closingBalance ?? 0,
      p_file_name: fileName ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function addBankStatementLine(
  statementId: string,
  transactionDate: string,
  description?: string,
  referenceNumber?: string,
  debit?: number,
  credit?: number,
  direction?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_bank_statement_line', {
      p_statement_id: statementId,
      p_transaction_date: transactionDate,
      p_description: description ?? null,
      p_reference_number: referenceNumber ?? null,
      p_debit: debit ?? 0,
      p_credit: credit ?? 0,
      p_direction: direction ?? 'credit',
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getBankStatementLines(
  statementId: string,
  matchStatus?: string,
  options: RequestOptions = {}
): Promise<BankStatementLine[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_bank_statement_lines', { p_statement_id: statementId, p_match_status: matchStatus ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    line_id: String(raw.line_id ?? ''),
    transaction_date: String(raw.transaction_date ?? ''),
    description: raw.description ? String(raw.description) : null,
    reference_number: raw.reference_number ? String(raw.reference_number) : null,
    debit: Number(raw.debit ?? 0),
    credit: Number(raw.credit ?? 0),
    amount: Number(raw.amount ?? 0),
    direction: String(raw.direction ?? 'credit'),
    match_status: String(raw.match_status ?? 'unmatched'),
    matched_payment_id: raw.matched_payment_id ? String(raw.matched_payment_id) : null,
    matched_collection_id: raw.matched_collection_id ? String(raw.matched_collection_id) : null,
    is_duplicate: Boolean(raw.is_duplicate),
    match_notes: raw.match_notes ? String(raw.match_notes) : null,
  }));
}

export async function matchBankLine(
  lineId: string,
  paymentId?: string,
  collectionId?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('match_bank_line', {
      p_line_id: lineId,
      p_payment_id: paymentId ?? null,
      p_collection_id: collectionId ?? null,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function unmatchBankLine(
  lineId: string,
  reason?: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('unmatch_bank_line', { p_line_id: lineId, p_reason: reason ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function completeReconciliation(
  statementId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('complete_reconciliation', { p_statement_id: statementId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: string }).name === 'AbortError')
  );
}

export function describeAnalyticsError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!error) return fallback;

  if (error instanceof Error && error.name === 'AnalyticsContractError') {
    return error.message;
  }

  const e = error as { code?: string; message?: string };
  const code = e.code;
  const message = e.message;

  if (code === 'P0001' && message) return message;
  if (code === '42501') return 'You do not have permission to view these analytics.';
  if (code === 'PGRST301' || code === '401') {
    return 'Your session has expired. Please sign in again.';
  }

  console.error('[analytics]', code ?? 'unknown', message ?? error);
  return fallback;
}

// ---------------------------------------------------------------------------
// Receipt share tokens + fee statement + guardian contacts
// ---------------------------------------------------------------------------
export interface GuardianContact {
  guardian_name: string | null;
  guardian_phone: string | null;
  relationship: string | null;
  is_primary: boolean;
  source: string | null;
}

export async function getStudentGuardianContacts(
  studentId: string,
  options: RequestOptions = {}
): Promise<GuardianContact[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_guardian_contacts', { p_student_id: studentId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []) as GuardianContact[];
}

export interface FeeStatementRow {
  row_kind: string;
  description: string | null;
  term: string | null;
  academic_year: number | null;
  occurred_at: string | null;
  receipt_number: string | null;
  payment_method: string | null;
  paid_by: string | null;
  amount: number;
  running_balance: number;
}

export async function getFeeStatement(
  studentId: string,
  term?: string,
  academicYear?: number,
  options: RequestOptions = {}
): Promise<FeeStatementRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_statement', { p_student_id: studentId, p_term: term ?? null, p_academic_year: academicYear ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []) as FeeStatementRow[];
}

export async function createReceiptShareToken(
  receiptId: string,
  expiresDays?: number,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_receipt_share_token', { p_receipt_id: receiptId, p_expires_days: expiresDays ?? 30 })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) throw new AnalyticsContractError('create_receipt_share_token');
  return data;
}

export interface ReceiptByToken {
  receipt: { id: string; receipt_number: string; amount_paid: number; payment_method: string; reference_number: string | null; paid_at: string };
  payment: { id: string; amount: number; payment_method: string; reference_number: string | null; academic_year: number | null; term: string | null; paid_by: string | null; paid_at: string };
  student: { id: string; full_name: string; admission_no: string; class_name: string | null };
  school: { name: string; logo_url: string | null; motto: string | null; county: string | null; region: string | null; country: string | null; contact_phone: string | null; contact_email: string | null };
  expires_at: string;
}

export async function getReceiptByToken(
  token: string,
  options: RequestOptions = {}
): Promise<ReceiptByToken> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_receipt_by_token', { p_token: token, p_ip: null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return data as ReceiptByToken;
}

export async function revokeReceiptShareToken(
  token: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('revoke_receipt_share_token', { p_token: token })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}
