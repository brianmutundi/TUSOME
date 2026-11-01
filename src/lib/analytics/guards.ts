import type {
  AccountDirectoryRow,
  FeeBalance,
  FeePayment,
  FeePledge,
  FeeStructure,
  AttendanceRow,
  BehaviourRow,
  ClassOption,
  MessageLogRow,
  MessageRecipients,
  PendingSmsRow,
  Pathway,
  StudentGroup,
  StudentNote,
  StudentResidence,
  SubjectPaper,
  SubjectPublishStatusRow,
  ReportTemplateConfig,
  SchoolProfile,
  SchoolValidity,
  TermDateRow,
  ClassPerformanceStudent,
  ExamLifecycleStatus,
  ExamMarkEntryRow,
  ExamOption,
  ExamPipelineRow,
  ExamPublishReadinessRow,
  ExamSetupOptions,
  GradeDistribution,
  MarkSheetRow,
  MostImprovedRow,
  PermissionCatalogueItem,
  RoleScope,
  RoleWithPermissionsRow,
  SectionHeadRow,
  StaffGroupRow,
  StaffType,
  StreamOption,
  StudentDirectoryRow,
  StudentExamHistoryRow,
  StudentProfileData,
  StudentReportData,
  StudentReportSubject,
  SubjectOption,
  SubjectPerformance,
  TeacherAllocationRow,
  TeacherAllocationType,
  TeacherDirectoryRow,
  TeacherSubjectClassPerformanceRow,
  UserPermissionProfile,
} from './types';

/**
 * Raised when Supabase returns a shape the UI cannot safely render.
 * The message is safe to show: it never includes row contents.
 */
export class AnalyticsContractError extends Error {
  constructor(context: string) {
    super(`The analytics service returned an unexpected response (${context}).`);
    this.name = 'AnalyticsContractError';
  }
}

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown, field: string): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) throw new AnalyticsContractError(field);
  return n;
}

function asNullableNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  return asNumber(value, field);
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AnalyticsContractError(field);
  }
  return value;
}

function asNullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new AnalyticsContractError(field);
  return value.length === 0 ? null : value;
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new AnalyticsContractError(field);
  return value;
}

function asStaffType(value: unknown, field: string): StaffType {
  if (value === 'TEACHER' || value === 'OFFICIAL' || value === 'WORKER') return value;
  throw new AnalyticsContractError(field);
}

function asRoleScope(value: unknown, field: string): RoleScope {
  if (value === 'GLOBAL' || value === 'CUSTOM') return value;
  throw new AnalyticsContractError(field);
}

function asExamStatus(value: unknown, field: string): ExamLifecycleStatus {
  if (
    value === 'draft' ||
    value === 'review' ||
    value === 'published' ||
    value === 'reopened'
  ) {
    return value;
  }
  throw new AnalyticsContractError(field);
}

function asAllocationType(value: unknown, field: string): TeacherAllocationType {
  if (
    value === 'SUBJECT_TEACHER' ||
    value === 'CLASS_TEACHER' ||
    value === 'CLASS_SUPERVISOR'
  ) {
    return value;
  }
  throw new AnalyticsContractError(field);
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new AnalyticsContractError(field);
  return value.map((item, idx) => asString(item, `${field}[${idx}]`));
}

function asArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) throw new AnalyticsContractError(context);
  return value;
}

export function normalizeClassPerformance(data: unknown): ClassPerformanceStudent[] {
  return asArray(data, 'class performance').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`class performance row ${index}`);
    return {
      student_id: asString(raw.student_id, 'student_id'),
      admission_no: asString(raw.admission_no, 'admission_no'),
      student_name: asString(raw.student_name, 'student_name'),
      stream_name: asNullableString(raw.stream_name, 'stream_name'),
      total_score: asNumber(raw.total_score, 'total_score'),
      mean_score: asNumber(raw.mean_score, 'mean_score'),
      mean_percentage: asNumber(raw.mean_percentage, 'mean_percentage'),
      overall_grade: asNullableString(raw.overall_grade, 'overall_grade'),
      overall_points: asNullableNumber(raw.overall_points, 'overall_points'),
      class_position: asNumber(raw.class_position, 'class_position'),
      subjects_count: asNumber(raw.subjects_count, 'subjects_count'),
      passed_count: asNumber(raw.passed_count, 'passed_count'),
    };
  });
}

export function normalizeGradeDistribution(data: unknown): GradeDistribution[] {
  return asArray(data, 'grade distribution').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`grade distribution row ${index}`);
    return {
      grade_code: asString(raw.grade_code, 'grade_code'),
      grade_name: asString(raw.grade_name, 'grade_name'),
      broad_grade: asString(raw.broad_grade, 'broad_grade'),
      count: asNumber(raw.count, 'count'),
      percentage: asNumber(raw.percentage, 'percentage'),
      color: asString(raw.color, 'color'),
    };
  });
}

export function normalizeSubjectPerformance(data: unknown): SubjectPerformance[] {
  return asArray(data, 'subject performance').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`subject performance row ${index}`);
    return {
      subject_id: asString(raw.subject_id, 'subject_id'),
      subject_name: asString(raw.subject_name, 'subject_name'),
      subject_code: asNullableString(raw.subject_code, 'subject_code') ?? '',
      total_students: asNumber(raw.total_students, 'total_students'),
      mean_score: asNumber(raw.mean_score, 'mean_score'),
      highest_score: asNumber(raw.highest_score, 'highest_score'),
      lowest_score: asNumber(raw.lowest_score, 'lowest_score'),
      pass_count: asNumber(raw.pass_count, 'pass_count'),
      pass_rate: asNumber(raw.pass_rate, 'pass_rate'),
      ee_count: asNumber(raw.ee_count, 'ee_count'),
      me_count: asNumber(raw.me_count, 'me_count'),
      ae_count: asNumber(raw.ae_count, 'ae_count'),
      be_count: asNumber(raw.be_count, 'be_count'),
    };
  });
}

function normalizeReportSubject(raw: unknown, index: number): StudentReportSubject {
  if (!isRow(raw)) throw new AnalyticsContractError(`report subject ${index}`);
  return {
    subject_id: asString(raw.subject_id, 'subject_id'),
    subject_name: asString(raw.subject_name, 'subject_name'),
    subject_code: asNullableString(raw.subject_code, 'subject_code'),
    score: asNumber(raw.score, 'score'),
    percentage: asNumber(raw.percentage, 'percentage'),
    grade: asString(raw.grade, 'grade'),
    grade_name: asString(raw.grade_name, 'grade_name'),
    points: asNullableNumber(raw.points, 'points'),
  };
}

export function normalizeStudentReport(data: unknown): StudentReportData {
  if (!isRow(data)) throw new AnalyticsContractError('student report');

  const student = data.student;
  const school = data.school;
  const exam = data.exam;
  const summary = data.summary;

  if (!isRow(student)) throw new AnalyticsContractError('student');
  if (!isRow(school)) throw new AnalyticsContractError('school');
  if (!isRow(exam)) throw new AnalyticsContractError('exam');
  if (!isRow(summary)) throw new AnalyticsContractError('summary');

  return {
    student: {
      id: asString(student.id, 'student.id'),
      admission_no: asString(student.admission_no, 'student.admission_no'),
      name: asString(student.name, 'student.name'),
      class: asNullableString(student.class, 'student.class'),
      stream: asNullableString(student.stream, 'student.stream'),
      academic_year: asNullableNumber(student.academic_year, 'student.academic_year'),
      gender: asNullableString(student.gender, 'student.gender'),
    },
    school: { name: asString(school.name, 'school.name') },
    exam: {
      name: asString(exam.name, 'exam.name'),
      term: asString(exam.term, 'exam.term'),
      year: asNumber(exam.year, 'exam.year'),
      assessment_component: asNullableString(
        exam.assessment_component,
        'exam.assessment_component'
      ) ?? '',
    },
    subjects: asArray(data.subjects, 'subjects').map(normalizeReportSubject),
    summary: {
      total_score: asNumber(summary.total_score, 'summary.total_score'),
      mean_percentage: asNumber(summary.mean_percentage, 'summary.mean_percentage'),
      subjects_count: asNumber(summary.subjects_count, 'summary.subjects_count'),
      position: asNullableNumber(summary.position, 'summary.position'),
      total_in_class: asNumber(summary.total_in_class, 'summary.total_in_class'),
    },
  };
}

export function normalizeMarkSheet(data: unknown): MarkSheetRow[] {
  return asArray(data, 'mark sheet').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`mark sheet row ${index}`);
    return {
      student_id: asString(raw.student_id, 'student_id'),
      admission_no: asString(raw.admission_no, 'admission_no'),
      student_name: asString(raw.student_name, 'student_name'),
      class_name: asNullableString(raw.class_name, 'class_name'),
      stream_name: asNullableString(raw.stream_name, 'stream_name'),
      subject_id: asString(raw.subject_id, 'subject_id'),
      subject_name: asString(raw.subject_name, 'subject_name'),
      subject_code: asNullableString(raw.subject_code, 'subject_code'),
      score: asNumber(raw.score, 'score'),
      grade_code: asNullableString(raw.grade_code, 'grade_code'),
      grade_name: asNullableString(raw.grade_name, 'grade_name'),
      points: asNullableNumber(raw.points, 'points'),
    };
  });
}

export function normalizeStudentExamHistory(data: unknown): StudentExamHistoryRow[] {
  return asArray(data, 'student exam history').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`exam history row ${index}`);
    return {
      exam_id: asString(raw.exam_id, 'exam_id'),
      exam_name: asString(raw.exam_name, 'exam_name'),
      term: asNullableString(raw.term, 'term'),
      academic_year: asNullableNumber(raw.academic_year, 'academic_year'),
      assessment_component: asNullableString(
        raw.assessment_component,
        'assessment_component'
      ),
      total_score: asNumber(raw.total_score, 'total_score'),
      mean_score: asNumber(raw.mean_score, 'mean_score'),
      subjects_count: asNumber(raw.subjects_count, 'subjects_count'),
      overall_grade: asNullableString(raw.overall_grade, 'overall_grade'),
      overall_points: asNullableNumber(raw.overall_points, 'overall_points'),
      position: asNumber(raw.position, 'position'),
      total_in_exam: asNumber(raw.total_in_exam, 'total_in_exam'),
    };
  });
}

export function normalizeMostImproved(data: unknown): MostImprovedRow[] {
  return asArray(data, 'most improved').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`most improved row ${index}`);
    return {
      student_id: asString(raw.student_id, 'student_id'),
      admission_no: asString(raw.admission_no, 'admission_no'),
      student_name: asString(raw.student_name, 'student_name'),
      stream_name: asNullableString(raw.stream_name, 'stream_name'),
      current_mean: asNumber(raw.current_mean, 'current_mean'),
      previous_mean: asNumber(raw.previous_mean, 'previous_mean'),
      delta: asNumber(raw.delta, 'delta'),
      previous_exam_name: asString(raw.previous_exam_name, 'previous_exam_name'),
    };
  });
}

export function normalizeAccountDirectory(data: unknown): AccountDirectoryRow[] {
  return asArray(data, 'account directory').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`account directory row ${index}`);
    const role = asNullableString(raw.role, 'role');
    const inferredStaffType: StaffType =
      (role ?? '').trim().toLowerCase() === 'teacher'
        ? 'TEACHER'
        : ['worker', 'secretary', 'messenger', 'librarian'].includes(
              (role ?? '').trim().toLowerCase()
            )
          ? 'WORKER'
          : 'OFFICIAL';
    return {
      account_id: asString(raw.account_id, 'account_id'),
      full_name: asNullableString(raw.full_name, 'full_name'),
      email: raw.email === undefined ? null : asNullableString(raw.email, 'email'),
      role,
      staff_type:
        raw.staff_type === undefined || raw.staff_type === null
          ? inferredStaffType
          : asStaffType(raw.staff_type, 'staff_type'),
      is_active: asBoolean(raw.is_active, 'is_active'),
      access_revoked:
        raw.access_revoked === undefined
          ? false
          : asBoolean(raw.access_revoked, 'access_revoked'),
      granted_overrides:
        raw.granted_overrides === undefined
          ? 0
          : asNumber(raw.granted_overrides, 'granted_overrides'),
      denied_overrides:
        raw.denied_overrides === undefined
          ? 0
          : asNumber(raw.denied_overrides, 'denied_overrides'),
      created_at: asString(raw.created_at, 'created_at'),
    };
  });
}

export function normalizePermissionCatalogue(data: unknown): PermissionCatalogueItem[] {
  return asArray(data, 'permission catalogue').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`permission row ${index}`);
    return {
      code: asString(raw.code, 'code'),
      category_code: asString(raw.category_code, 'category_code'),
      category_name: asString(raw.category_name, 'category_name'),
      display_name: asString(raw.display_name, 'display_name'),
      sort_order: asNumber(raw.sort_order, 'sort_order'),
    };
  });
}

export function normalizeRolesWithPermissions(data: unknown): RoleWithPermissionsRow[] {
  return asArray(data, 'roles with permissions').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`role row ${index}`);
    return {
      role_id: asNullableString(raw.role_id, 'role_id'),
      role_key: asString(raw.role_key, 'role_key'),
      display_name: asString(raw.display_name, 'display_name'),
      description: asNullableString(raw.description, 'description') ?? '',
      staff_type: asStaffType(raw.staff_type, 'staff_type'),
      scope: asRoleScope(raw.scope, 'scope'),
      member_count: asNumber(raw.member_count, 'member_count'),
      active_count: asNumber(raw.active_count, 'active_count'),
      inactive_count: asNumber(raw.inactive_count, 'inactive_count'),
      permission_codes: asStringArray(raw.permission_codes ?? [], 'permission_codes'),
    };
  });
}

export function normalizeUserPermissionProfile(data: unknown): UserPermissionProfile {
  if (!isRow(data)) throw new AnalyticsContractError('user permission profile');
  return {
    account_id: asString(data.account_id, 'account_id'),
    full_name: asNullableString(data.full_name, 'full_name'),
    email: asNullableString(data.email, 'email'),
    role: asNullableString(data.role, 'role'),
    staff_type: asStaffType(data.staff_type, 'staff_type'),
    is_active: asBoolean(data.is_active, 'is_active'),
    access_revoked: asBoolean(data.access_revoked, 'access_revoked'),
    role_permissions: asStringArray(data.role_permissions ?? [], 'role_permissions'),
    granted_overrides: asStringArray(data.granted_overrides ?? [], 'granted_overrides'),
    denied_overrides: asStringArray(data.denied_overrides ?? [], 'denied_overrides'),
    effective_permissions: asStringArray(
      data.effective_permissions ?? [],
      'effective_permissions'
    ),
  };
}

export function normalizeSectionHeads(data: unknown): SectionHeadRow[] {
  return asArray(data, 'section heads').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`section head row ${index}`);
    return {
      section_head_id: asString(raw.section_head_id, 'section_head_id'),
      form_level: asString(raw.form_level, 'form_level'),
      user_id: asString(raw.user_id, 'user_id'),
      user_full_name: asNullableString(raw.user_full_name, 'user_full_name'),
      user_email: asNullableString(raw.user_email, 'user_email'),
      user_role: asNullableString(raw.user_role, 'user_role'),
      staff_type: asStaffType(raw.staff_type, 'staff_type'),
      created_at: asString(raw.created_at, 'created_at'),
    };
  });
}

export function normalizeStudentDirectory(data: unknown): StudentDirectoryRow[] {
  return asArray(data, 'student directory').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`student directory row ${index}`);
    return {
      student_id: asString(raw.student_id, 'student_id'),
      admission_no: asString(raw.admission_no, 'admission_no'),
      full_name: asNullableString(raw.full_name, 'full_name'),
      gender: asNullableString(raw.gender, 'gender'),
      class_id: asNullableString(raw.class_id, 'class_id'),
      class_name: asNullableString(raw.class_name, 'class_name'),
      stream_id: asNullableString(raw.stream_id, 'stream_id'),
      stream_name: asNullableString(raw.stream_name, 'stream_name'),
      academic_year: asNullableNumber(raw.academic_year, 'academic_year'),
      pathway_name: asNullableString(raw.pathway_name, 'pathway_name'),
      in_school_status: asNullableString(raw.in_school_status, 'in_school_status'),
      created_at: asString(raw.created_at, 'created_at'),
    };
  });
}

export function normalizeStudentProfile(data: unknown): StudentProfileData {
  if (!isRow(data)) throw new AnalyticsContractError('student profile');
  return {
    student_id: asString(data.student_id, 'student_id'),
    admission_no: asString(data.admission_no, 'admission_no'),
    full_name: asNullableString(data.full_name, 'full_name'),
    gender: asNullableString(data.gender, 'gender'),
    class_id: asNullableString(data.class_id, 'class_id'),
    stream_id: asNullableString(data.stream_id, 'stream_id'),
    pathway: asNullableString(data.pathway, 'pathway'),
    created_at: asString(data.created_at, 'created_at'),
    enrollments: asArray(data.enrollments ?? [], 'enrollments').map((raw, index) => {
      if (!isRow(raw)) throw new AnalyticsContractError(`enrollment row ${index}`);
      return {
        academic_year: asNullableNumber(raw.academic_year, 'academic_year'),
        class_id: asNullableString(raw.class_id, 'class_id'),
        class_name: asNullableString(raw.class_name, 'class_name'),
        stream_id: asNullableString(raw.stream_id, 'stream_id'),
        stream_name: asNullableString(raw.stream_name, 'stream_name'),
        created_at: asNullableString(raw.created_at, 'created_at'),
      };
    }),
    published_exams_with_marks: asArray(
      data.published_exams_with_marks ?? [],
      'published_exams_with_marks'
    ).map((raw, index) => {
      if (!isRow(raw)) throw new AnalyticsContractError(`published exam row ${index}`);
      return {
        exam_id: asString(raw.exam_id, 'exam_id'),
        exam_name: asString(raw.exam_name, 'exam_name'),
        term: asNullableString(raw.term, 'term'),
        academic_year: asNullableNumber(raw.academic_year, 'academic_year'),
        status: asString(raw.status, 'status'),
      };
    }),
  };
}

export function normalizeSchoolProfile(data: unknown): SchoolProfile {
  if (!isRow(data)) throw new AnalyticsContractError('school profile');
  return {
    tenant_id: asString(data.tenant_id, 'tenant_id'),
    name: asString(data.name, 'name'),
    school_type: asNullableString(data.school_type, 'school_type'),
    country: asNullableString(data.country, 'country'),
    region: asNullableString(data.region, 'region'),
    county: asNullableString(data.county, 'county'),
    education_system: asNullableString(data.education_system, 'education_system'),
    ownership_type: asNullableString(data.ownership_type, 'ownership_type'),
    setup_stage: asNullableString(data.setup_stage, 'setup_stage'),
    contact_person: asNullableString(data.contact_person, 'contact_person'),
    contact_phone: asNullableString(data.contact_phone, 'contact_phone'),
    contact_email: asNullableString(data.contact_email, 'contact_email'),
    is_valid: asBoolean(data.is_valid, 'is_valid'),
    subscription_status: asString(data.subscription_status, 'subscription_status'),
    subscription_expires_at: asNullableString(
      data.subscription_expires_at,
      'subscription_expires_at'
    ),
    watermark_url: asNullableString(data.watermark_url, 'watermark_url'),
    logo_url: asNullableString(data.logo_url, 'logo_url'),
    motto: asNullableString(data.motto, 'motto'),
    created_at: asString(data.created_at, 'created_at'),
  };
}

export function normalizeSchoolValidity(data: unknown): SchoolValidity {
  if (!isRow(data)) throw new AnalyticsContractError('school validity');
  return {
    tenant_id: asString(data.tenant_id, 'tenant_id'),
    name: asString(data.name, 'name'),
    is_valid: asBoolean(data.is_valid, 'is_valid'),
    subscription_status: asString(data.subscription_status, 'subscription_status'),
    subscription_expires_at: asNullableString(
      data.subscription_expires_at,
      'subscription_expires_at'
    ),
    days_remaining: asNullableNumber(data.days_remaining, 'days_remaining'),
    is_expired: asBoolean(data.is_expired, 'is_expired'),
  };
}

export function normalizePendingSms(data: unknown): PendingSmsRow[] {
  return asArray(data, 'pending sms').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`pending sms row ${index}`);
    return {
      message_id: asString(raw.message_id, 'message_id'),
      phone_numbers: Array.isArray(raw.phone_numbers)
        ? raw.phone_numbers.map(String)
        : [],
      message_body: asString(raw.message_body, 'message_body'),
      recipient_count: asNumber(raw.recipient_count, 'recipient_count'),
      created_at: asString(raw.created_at, 'created_at'),
    };
  });
}

export function normalizeAttendance(data: unknown): AttendanceRow[] {
  return asArray(data, 'attendance').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError('attendance row ' + index);
    return {
      student_id: asString(raw.student_id, 'student_id'),
      student_name: asNullableString(raw.student_name, 'student_name'),
      admission_no: asString(raw.admission_no, 'admission_no'),
      status: asString(raw.status, 'status'),
      remarks: asNullableString(raw.remarks, 'remarks'),
    };
  });
}

export function normalizeBehaviour(data: unknown): BehaviourRow[] {
  return asArray(data, 'behaviour').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError('behaviour row ' + index);
    return {
      id: asString(raw.id, 'id'),
      student_id: asString(raw.student_id, 'student_id'),
      behaviour_type: asString(raw.behaviour_type, 'behaviour_type'),
      description: asNullableString(raw.description, 'description'),
      severity: asNullableString(raw.severity, 'severity'),
      recorded_by: asNullableString(raw.recorded_by, 'recorded_by'),
      recorded_at: asString(raw.recorded_at, 'recorded_at'),
      action_taken: asNullableString(raw.action_taken, 'action_taken'),
    };
  });
}

export function normalizeStudentNotes(data: unknown): StudentNote[] {
  return asArray(data, 'student notes').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError('student note ' + index);
    return {
      id: asString(raw.id, 'id'),
      student_id: asString(raw.student_id, 'student_id'),
      note_type: asString(raw.note_type, 'note_type'),
      title: asNullableString(raw.title, 'title'),
      content: asString(raw.content, 'content'),
      created_by: asNullableString(raw.created_by, 'created_by'),
      created_at: asString(raw.created_at, 'created_at'),
    };
  });
}

export function normalizeStudentGroups(data: unknown): StudentGroup[] {
  return asArray(data, 'student groups').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError('student group ' + index);
    return {
      id: asString(raw.id, 'id'),
      name: asString(raw.name, 'name'),
      description: asNullableString(raw.description, 'description'),
      member_count: asNumber(raw.member_count, 'member_count'),
    };
  });
}

export function normalizeStudentResidences(data: unknown): StudentResidence[] {
  return asArray(data, 'student residences').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError('student residence ' + index);
    return {
      id: asString(raw.id, 'id'),
      name: asString(raw.name, 'name'),
      residence_type: asString(raw.residence_type, 'residence_type'),
      capacity: asNullableNumber(raw.capacity, 'capacity'),
      supervisor_name: asNullableString(raw.supervisor_name, 'supervisor_name'),
      occupant_count: asNumber(raw.occupant_count, 'occupant_count'),
    };
  });
}

export function normalizeSubjectPapers(data: unknown): SubjectPaper[] {
  return asArray(data, 'subject papers').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError('subject paper ' + index);
    return {
      id: asString(raw.id, 'id'),
      subject_id: asString(raw.subject_id, 'subject_id'),
      name: asString(raw.name, 'name'),
      code: asNullableString(raw.code, 'code'),
      max_marks: asNumber(raw.max_marks, 'max_marks'),
      weight: asNumber(raw.weight, 'weight'),
      sort_order: asNumber(raw.sort_order, 'sort_order'),
    };
  });
}

export function normalizePathways(data: unknown): Pathway[] {
  return asArray(data, 'pathways').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError('pathway ' + index);
    return {
      id: asString(raw.id, 'id'),
      name: asString(raw.name, 'name'),
      track: asNullableString(raw.track, 'track'),
      description: asNullableString(raw.description, 'description'),
    };
  });
}

export function normalizeFeeStructures(data: unknown): FeeStructure[] {
  return asArray(data, 'fee structures').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError('fee structure ' + index);
    return {
      structure_id: asString(raw.structure_id, 'structure_id'),
      class_id: asNullableString(raw.class_id, 'class_id'),
      class_name: asNullableString(raw.class_name, 'class_name'),
      academic_year: asNumber(raw.academic_year, 'academic_year'),
      term: asString(raw.term, 'term'),
      name: asString(raw.name, 'name'),
      amount: asNumber(raw.amount, 'amount'),
      description: asNullableString(raw.description, 'description'),
      is_active: Boolean(raw.is_active),
      created_at: asString(raw.created_at, 'created_at'),
    };
  });
}

export function normalizeFeePayments(data: unknown): FeePayment[] {
  return asArray(data, 'fee payments').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError('fee payment ' + index);
    return {
      payment_id: asString(raw.payment_id, 'payment_id'),
      student_id: asString(raw.student_id, 'student_id'),
      student_name: asNullableString(raw.student_name, 'student_name'),
      admission_no: asString(raw.admission_no, 'admission_no'),
      amount: asNumber(raw.amount, 'amount'),
      payment_method: asString(raw.payment_method, 'payment_method'),
      reference_number: asNullableString(raw.reference_number, 'reference_number'),
      academic_year: asNullableNumber(raw.academic_year, 'academic_year'),
      term: asNullableString(raw.term, 'term'),
      notes: asNullableString(raw.notes, 'notes'),
      recorded_by_name: asNullableString(raw.recorded_by_name, 'recorded_by_name'),
      paid_at: asString(raw.paid_at, 'paid_at'),
    };
  });
}

export function normalizeFeePledges(data: unknown): FeePledge[] {
  return asArray(data, 'fee pledges').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError('fee pledge ' + index);
    return {
      pledge_id: asString(raw.pledge_id, 'pledge_id'),
      student_id: asString(raw.student_id, 'student_id'),
      student_name: asNullableString(raw.student_name, 'student_name'),
      admission_no: asString(raw.admission_no, 'admission_no'),
      pledged_amount: asNumber(raw.pledged_amount, 'pledged_amount'),
      paid_amount: asNumber(raw.paid_amount, 'paid_amount'),
      remaining_amount: asNumber(raw.remaining_amount, 'remaining_amount'),
      due_date: asNullableString(raw.due_date, 'due_date'),
      status: asString(raw.status, 'status'),
      notes: asNullableString(raw.notes, 'notes'),
      created_at: asString(raw.created_at, 'created_at'),
    };
  });
}

export function normalizeTermDates(data: unknown): TermDateRow[] {
  return asArray(data, 'term dates').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`term date row ${index}`);
    return {
      term_date_id: asString(raw.term_date_id, 'term_date_id'),
      academic_year: asNumber(raw.academic_year, 'academic_year'),
      term: asString(raw.term, 'term'),
      opening_date: asString(raw.opening_date, 'opening_date'),
      closing_date: asString(raw.closing_date, 'closing_date'),
    };
  });
}

export function normalizeMessageLog(data: unknown): MessageLogRow[] {
  return asArray(data, 'message log').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`message log row ${index}`);
    return {
      message_id: asString(raw.message_id, 'message_id'),
      recipient_type: asString(raw.recipient_type, 'recipient_type'),
      message_type: asString(raw.message_type, 'message_type'),
      subject: asNullableString(raw.subject, 'subject'),
      message_body: asString(raw.message_body, 'message_body'),
      recipient_count: asNumber(raw.recipient_count, 'recipient_count'),
      credits_used: asNumber(raw.credits_used, 'credits_used'),
      status: asString(raw.status, 'status'),
      exam_id: asNullableString(raw.exam_id, 'exam_id'),
      exam_name: asNullableString(raw.exam_name, 'exam_name'),
      sent_at: asNullableString(raw.sent_at, 'sent_at'),
      created_at: asString(raw.created_at, 'created_at'),
      sender_name: asNullableString(raw.sender_name, 'sender_name'),
    };
  });
}

export function normalizeMessageRecipients(data: unknown): MessageRecipients {
  if (!isRow(data)) throw new AnalyticsContractError('message recipients');
  return {
    students: asArray(data.students ?? [], 'students').map((raw, index) => {
      if (!isRow(raw)) throw new AnalyticsContractError(`student recipient ${index}`);
      return {
        id: asString(raw.id, 'id'),
        name: asNullableString(raw.name, 'name'),
        admission_no: asString(raw.admission_no, 'admission_no'),
        class_name: asNullableString(raw.class_name, 'class_name'),
        stream_name: asNullableString(raw.stream_name, 'stream_name'),
        gender: asNullableString(raw.gender, 'gender'),
      };
    }),
    teachers: asArray(data.teachers ?? [], 'teachers').map((raw, index) => {
      if (!isRow(raw)) throw new AnalyticsContractError(`teacher recipient ${index}`);
      return {
        id: asString(raw.id, 'id'),
        name: asNullableString(raw.name, 'name'),
        role: asNullableString(raw.role, 'role'),
        staff_type: asNullableString(raw.staff_type, 'staff_type'),
      };
    }),
    classes: asArray(data.classes ?? [], 'classes').map((raw, index) => {
      if (!isRow(raw)) throw new AnalyticsContractError(`class recipient ${index}`);
      return {
        id: asString(raw.id, 'id'),
        name: asString(raw.name, 'name'),
      };
    }),
    streams: asArray(data.streams ?? [], 'streams').map((raw, index) => {
      if (!isRow(raw)) throw new AnalyticsContractError(`stream recipient ${index}`);
      return {
        id: asString(raw.id, 'id'),
        class_id: asString(raw.class_id, 'class_id'),
        name: asString(raw.name, 'name'),
      };
    }),
  };
}

export function normalizeReportTemplateConfig(data: unknown): ReportTemplateConfig[] {
  return asArray(data, 'report template config').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`template config row ${index}`);
    return {
      config_key: asString(raw.config_key, 'config_key'),
      config_value: asString(raw.config_value, 'config_value'),
    };
  });
}

export function normalizeExams(data: unknown): ExamOption[] {
  return asArray(data, 'exams').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`exam row ${index}`);
    return {
      id: asString(raw.id, 'exam.id'),
      name: asString(raw.name, 'exam.name'),
      term: asNullableString(raw.term, 'exam.term'),
      academic_year: asNullableNumber(raw.academic_year, 'exam.academic_year'),
      assessment_component: asNullableString(
        raw.assessment_component,
        'exam.assessment_component'
      ),
      status: asString(raw.status, 'exam.status'),
      published_at: asNullableString(raw.published_at, 'exam.published_at'),
    };
  });
}

export function normalizeClasses(data: unknown): ClassOption[] {
  return asArray(data, 'classes').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`class row ${index}`);
    return {
      id: asString(raw.id, 'class.id'),
      name: asString(raw.name, 'class.name'),
    };
  });
}

export function normalizeStreams(data: unknown): StreamOption[] {
  return asArray(data, 'streams').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`stream row ${index}`);
    return {
      id: asString(raw.id, 'stream.id'),
      class_id: asString(raw.class_id, 'stream.class_id'),
      name: asString(raw.name, 'stream.name'),
    };
  });
}

export function normalizeSubjects(data: unknown): SubjectOption[] {
  return asArray(data, 'subjects').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`subject row ${index}`);
    return {
      id: asString(raw.id, 'subject.id'),
      name: asString(raw.name, 'subject.name'),
      code: asNullableString(raw.code, 'subject.code') ?? '',
    };
  });
}

export function normalizeExamSetupOptions(data: unknown): ExamSetupOptions {
  if (!isRow(data)) throw new AnalyticsContractError('exam setup options');
  return {
    classes: normalizeClasses(data.classes ?? []),
    streams: normalizeStreams(data.streams ?? []),
    subjects: normalizeSubjects(data.subjects ?? []),
  };
}

export function normalizeExamPipelineOverview(data: unknown): ExamPipelineRow[] {
  return asArray(data, 'exam pipeline overview').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`exam pipeline row ${index}`);
    return {
      exam_id: asString(raw.exam_id, 'exam_id'),
      name: asString(raw.name, 'name'),
      term: asNullableString(raw.term, 'term'),
      academic_year: asNullableNumber(raw.academic_year, 'academic_year'),
      assessment_component: asNullableString(
        raw.assessment_component,
        'assessment_component'
      ),
      status: asExamStatus(raw.status, 'status'),
      class_ids: asStringArray(raw.class_ids ?? [], 'class_ids'),
      class_names: asStringArray(raw.class_names ?? [], 'class_names'),
      enrolled_students: asNumber(raw.enrolled_students, 'enrolled_students'),
      students_with_marks: asNumber(raw.students_with_marks, 'students_with_marks'),
      subjects_with_marks: asNumber(raw.subjects_with_marks, 'subjects_with_marks'),
      total_marks_entered: asNumber(raw.total_marks_entered, 'total_marks_entered'),
      created_at: asString(raw.created_at, 'created_at'),
    };
  });
}

export function normalizeExamMarkEntryRoster(data: unknown): ExamMarkEntryRow[] {
  return asArray(data, 'exam mark entry roster').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`mark entry row ${index}`);
    return {
      student_id: asString(raw.student_id, 'student_id'),
      admission_no: asString(raw.admission_no, 'admission_no'),
      student_name: asString(raw.student_name, 'student_name'),
      class_id: asNullableString(raw.class_id, 'class_id'),
      class_name: asNullableString(raw.class_name, 'class_name'),
      stream_id: asNullableString(raw.stream_id, 'stream_id'),
      stream_name: asNullableString(raw.stream_name, 'stream_name'),
      score: asNullableNumber(raw.score, 'score'),
      grade_code: asNullableString(raw.grade_code, 'grade_code'),
      points: asNullableNumber(raw.points, 'points'),
    };
  });
}

export function normalizeExamPublishReadiness(data: unknown): ExamPublishReadinessRow[] {
  return asArray(data, 'exam publish readiness').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`publish readiness row ${index}`);
    return {
      subject_id: asString(raw.subject_id, 'subject_id'),
      subject_name: asString(raw.subject_name, 'subject_name'),
      subject_code: asNullableString(raw.subject_code, 'subject_code') ?? '',
      enrolled_students: asNumber(raw.enrolled_students, 'enrolled_students'),
      recorded_marks: asNumber(raw.recorded_marks, 'recorded_marks'),
      missing_marks: asNumber(raw.missing_marks, 'missing_marks'),
      mean_score: asNumber(raw.mean_score, 'mean_score'),
    };
  });
}

export function normalizeSubjectPublishStatus(data: unknown): SubjectPublishStatusRow[] {
  return asArray(data, 'subject publish status').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`subject publish status row ${index}`);
    return {
      subject_id: asString(raw.subject_id, 'subject_id'),
      subject_name: asString(raw.subject_name, 'subject_name'),
      subject_code: asNullableString(raw.subject_code, 'subject_code') ?? '',
      enrolled_students: asNumber(raw.enrolled_students, 'enrolled_students'),
      recorded_marks: asNumber(raw.recorded_marks, 'recorded_marks'),
      missing_marks: asNumber(raw.missing_marks, 'missing_marks'),
      mean_score: asNumber(raw.mean_score, 'mean_score'),
      published: asBoolean(raw.published, 'published'),
      published_at: asNullableString(raw.published_at, 'published_at'),
      teacher_access_granted: asBoolean(raw.teacher_access_granted, 'teacher_access_granted'),
    };
  });
}

export function normalizeTeacherDirectory(data: unknown): TeacherDirectoryRow[] {
  return asArray(data, 'teacher directory').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`teacher directory row ${index}`);
    return {
      account_id: asString(raw.account_id, 'account_id'),
      full_name: asNullableString(raw.full_name, 'full_name'),
      email: asNullableString(raw.email, 'email'),
      phone: asNullableString(raw.phone, 'phone'),
      initials: asNullableString(raw.initials, 'initials'),
      tsc_number: asNullableString(raw.tsc_number, 'tsc_number'),
      national_id: asNullableString(raw.national_id, 'national_id'),
      employee_number: asNullableString(raw.employee_number, 'employee_number'),
      gender: asNullableString(raw.gender, 'gender'),
      role: asNullableString(raw.role, 'role'),
      staff_type: asStaffType(raw.staff_type, 'staff_type'),
      is_active: asBoolean(raw.is_active, 'is_active'),
      access_revoked: asBoolean(raw.access_revoked, 'access_revoked'),
      group_names: asStringArray(raw.group_names ?? [], 'group_names'),
      subject_assignments_count: asNumber(
        raw.subject_assignments_count,
        'subject_assignments_count'
      ),
      class_teacher_labels: asStringArray(
        raw.class_teacher_labels ?? [],
        'class_teacher_labels'
      ),
      supervisor_labels: asStringArray(
        raw.supervisor_labels ?? [],
        'supervisor_labels'
      ),
      created_at: asString(raw.created_at, 'created_at'),
    };
  });
}

export function normalizeStaffGroups(data: unknown): StaffGroupRow[] {
  return asArray(data, 'staff groups').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`staff group row ${index}`);
    return {
      group_id: asString(raw.group_id, 'group_id'),
      name: asString(raw.name, 'name'),
      staff_type: asStaffType(raw.staff_type, 'staff_type'),
      member_count: asNumber(raw.member_count, 'member_count'),
      created_at: asString(raw.created_at, 'created_at'),
    };
  });
}

export function normalizeTeacherAllocations(data: unknown): TeacherAllocationRow[] {
  return asArray(data, 'teacher allocations').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`teacher allocation row ${index}`);
    return {
      allocation_id: asString(raw.allocation_id, 'allocation_id'),
      allocation_type: asAllocationType(raw.allocation_type, 'allocation_type'),
      academic_year: asNumber(raw.academic_year, 'academic_year'),
      class_id: asString(raw.class_id, 'class_id'),
      class_name: asString(raw.class_name, 'class_name'),
      stream_id: asNullableString(raw.stream_id, 'stream_id'),
      stream_name: asNullableString(raw.stream_name, 'stream_name'),
      subject_id: asNullableString(raw.subject_id, 'subject_id'),
      subject_name: asNullableString(raw.subject_name, 'subject_name'),
      subject_code: asNullableString(raw.subject_code, 'subject_code'),
      teacher_id: asString(raw.teacher_id, 'teacher_id'),
      teacher_name: asNullableString(raw.teacher_name, 'teacher_name'),
      teacher_initials: asNullableString(raw.teacher_initials, 'teacher_initials'),
      teacher_tsc_number: asNullableString(
        raw.teacher_tsc_number,
        'teacher_tsc_number'
      ),
    };
  });
}

export function normalizeTeacherSubjectClassPerformance(
  data: unknown
): TeacherSubjectClassPerformanceRow[] {
  return asArray(data, 'teacher subject class performance').map((raw, index) => {
    if (!isRow(raw)) throw new AnalyticsContractError(`teacher performance row ${index}`);
    return {
      allocation_id: asString(raw.allocation_id, 'allocation_id'),
      teacher_id: asString(raw.teacher_id, 'teacher_id'),
      teacher_name: asNullableString(raw.teacher_name, 'teacher_name'),
      teacher_initials: asNullableString(raw.teacher_initials, 'teacher_initials'),
      class_id: asString(raw.class_id, 'class_id'),
      class_name: asString(raw.class_name, 'class_name'),
      stream_id: asNullableString(raw.stream_id, 'stream_id'),
      stream_name: asNullableString(raw.stream_name, 'stream_name'),
      subject_id: asString(raw.subject_id, 'subject_id'),
      subject_name: asString(raw.subject_name, 'subject_name'),
      subject_code: asNullableString(raw.subject_code, 'subject_code') ?? '',
      students_count: asNumber(raw.students_count, 'students_count'),
      mean_score: asNumber(raw.mean_score, 'mean_score'),
      mean_grade: asNullableString(raw.mean_grade, 'mean_grade'),
      mean_points: asNullableNumber(raw.mean_points, 'mean_points'),
      pass_rate: asNumber(raw.pass_rate, 'pass_rate'),
    };
  });
}

// Deliberately permissive: PostgreSQL accepts any hexadecimal UUID-shaped text,
// and the test fixtures use non-versioned UUIDs. The database remains the
// authority; this only prevents obviously malformed route parameters.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
