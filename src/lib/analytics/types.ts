export interface ClassPerformanceStudent {
  student_id: string;
  admission_no: string;
  student_name: string;
  stream_name: string | null;
  total_score: number;
  mean_score: number;
  mean_percentage: number;
  overall_grade: string | null;
  overall_points: number | null;
  class_position: number;
  subjects_count: number;
  passed_count: number;
}

export interface GradeDistribution {
  grade_code: string;
  grade_name: string;
  broad_grade: string;
  count: number;
  percentage: number;
  color: string;
}

export interface SubjectPerformance {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  total_students: number;
  mean_score: number;
  highest_score: number;
  lowest_score: number;
  pass_count: number;
  pass_rate: number;
  ee_count: number;
  me_count: number;
  ae_count: number;
  be_count: number;
}

export interface StudentReportSubject {
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  score: number;
  percentage: number;
  grade: string;
  grade_name: string;
  points: number | null;
}

export interface StudentReportData {
  student: {
    id: string;
    admission_no: string;
    name: string;
    class: string | null;
    stream: string | null;
    /** Latest enrollment academic year; null when the student has no enrollment. */
    academic_year?: number | null;
    gender: string | null;
  };
  school: {
    name: string;
  };
  exam: {
    name: string;
    term: string;
    year: number;
    assessment_component: string;
  };
  subjects: StudentReportSubject[];
  summary: {
    total_score: number;
    mean_percentage: number;
    subjects_count: number;
    position: number | null;
    total_in_class: number;
  };
}

export interface MarkSheetRow {
  student_id: string;
  admission_no: string;
  student_name: string;
  class_name: string | null;
  stream_name: string | null;
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  score: number;
  grade_code: string | null;
  grade_name: string | null;
  points: number | null;
}

export interface StudentExamHistoryRow {
  exam_id: string;
  exam_name: string;
  term: string | null;
  academic_year: number | null;
  assessment_component: string | null;
  total_score: number;
  mean_score: number;
  subjects_count: number;
  overall_grade: string | null;
  overall_points: number | null;
  position: number;
  total_in_exam: number;
}

export interface MostImprovedRow {
  student_id: string;
  admission_no: string;
  student_name: string;
  stream_name: string | null;
  current_mean: number;
  previous_mean: number;
  delta: number;
  previous_exam_name: string;
}

export type StaffType = 'TEACHER' | 'OFFICIAL' | 'WORKER';
export type RoleScope = 'GLOBAL' | 'CUSTOM';

export interface AccountDirectoryRow {
  account_id: string;
  /** Null when the profile has no name recorded. */
  full_name: string | null;
  /** Account email from `profiles.email` or `auth.users.email`. */
  email?: string | null;
  /** Free-text role string from `profiles.role`; null when unset. */
  role: string | null;
  /** Zeraki staff classification (`TEACHER`, `OFFICIAL`, `WORKER`). */
  staff_type?: StaffType;
  is_active: boolean;
  /** True when all permissions are revoked via `set_user_access_revoked`. */
  access_revoked?: boolean;
  /** Count of per-user `GRANT` overrides in `user_permissions`. */
  granted_overrides?: number;
  /** Count of per-user `DENY` overrides in `user_permissions`. */
  denied_overrides?: number;
  /** ISO timestamp from `profiles.created_at`. */
  created_at: string;
}

export interface PermissionCatalogueItem {
  code: string;
  category_code: string;
  category_name: string;
  display_name: string;
  sort_order: number;
}

export interface RoleWithPermissionsRow {
  role_id: string | null;
  role_key: string;
  display_name: string;
  description: string;
  staff_type: StaffType;
  scope: RoleScope;
  member_count: number;
  active_count: number;
  inactive_count: number;
  permission_codes: string[];
}

export interface UserPermissionProfile {
  account_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  staff_type: StaffType;
  is_active: boolean;
  access_revoked: boolean;
  role_permissions: string[];
  granted_overrides: string[];
  denied_overrides: string[];
  effective_permissions: string[];
}

export interface SectionHeadRow {
  section_head_id: string;
  form_level: string;
  user_id: string;
  user_full_name: string | null;
  user_email: string | null;
  user_role: string | null;
  staff_type: StaffType;
  created_at: string;
}

export type ExamLifecycleStatus = 'draft' | 'review' | 'published' | 'reopened';
export type AssessmentComponentCode = 'test_exam' | 'mid_term' | 'end_term' | 'annual';

export interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

export interface ExamSetupOptions {
  classes: ClassOption[];
  streams: StreamOption[];
  subjects: SubjectOption[];
}

export interface ExamPipelineRow {
  exam_id: string;
  name: string;
  term: string | null;
  academic_year: number | null;
  assessment_component: string | null;
  status: ExamLifecycleStatus;
  class_ids: string[];
  class_names: string[];
  enrolled_students: number;
  students_with_marks: number;
  subjects_with_marks: number;
  total_marks_entered: number;
  created_at: string;
}

export interface ExamMarkEntryRow {
  student_id: string;
  admission_no: string;
  student_name: string;
  class_id: string | null;
  class_name: string | null;
  stream_id: string | null;
  stream_name: string | null;
  score: number | null;
  grade_code: string | null;
  points: number | null;
}

export interface SubjectPublishStatusRow {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  enrolled_students: number;
  recorded_marks: number;
  missing_marks: number;
  mean_score: number;
  published: boolean;
  published_at: string | null;
  teacher_access_granted: boolean;
}

export interface ExamPublishReadinessRow {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  enrolled_students: number;
  recorded_marks: number;
  missing_marks: number;
  mean_score: number;
}

export type TeacherAllocationType =
  | 'SUBJECT_TEACHER'
  | 'CLASS_TEACHER'
  | 'CLASS_SUPERVISOR';

export interface TeacherDirectoryRow {
  account_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  initials: string | null;
  tsc_number: string | null;
  national_id: string | null;
  employee_number: string | null;
  gender: string | null;
  role: string | null;
  staff_type: StaffType;
  is_active: boolean;
  access_revoked: boolean;
  group_names: string[];
  subject_assignments_count: number;
  class_teacher_labels: string[];
  supervisor_labels: string[];
  created_at: string;
}

export interface StaffGroupRow {
  group_id: string;
  name: string;
  staff_type: StaffType;
  member_count: number;
  created_at: string;
}

export interface TeacherAllocationRow {
  allocation_id: string;
  allocation_type: TeacherAllocationType;
  academic_year: number;
  class_id: string;
  class_name: string;
  stream_id: string | null;
  stream_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  subject_code: string | null;
  teacher_id: string;
  teacher_name: string | null;
  teacher_initials: string | null;
  teacher_tsc_number: string | null;
}

export interface TeacherSubjectClassPerformanceRow {
  allocation_id: string;
  teacher_id: string;
  teacher_name: string | null;
  teacher_initials: string | null;
  class_id: string;
  class_name: string;
  stream_id: string | null;
  stream_name: string | null;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  students_count: number;
  mean_score: number;
  mean_grade: string | null;
  mean_points: number | null;
  pass_rate: number;
}

export interface StudentDirectoryRow {
  student_id: string;
  admission_no: string;
  full_name: string | null;
  gender: string | null;
  class_id: string | null;
  class_name: string | null;
  stream_id: string | null;
  stream_name: string | null;
  academic_year: number | null;
  pathway_name: string | null;
  in_school_status: string | null;
  created_at: string;
}

export interface StudentProfileData {
  student_id: string;
  admission_no: string;
  full_name: string | null;
  gender: string | null;
  class_id: string | null;
  stream_id: string | null;
  pathway: string | null;
  created_at: string;
  enrollments: Array<{
    academic_year: number | null;
    class_id: string | null;
    class_name: string | null;
    stream_id: string | null;
    stream_name: string | null;
    created_at: string | null;
  }>;
  published_exams_with_marks: Array<{
    exam_id: string;
    exam_name: string;
    term: string | null;
    academic_year: number | null;
    status: string;
  }>;
}

export interface SchoolProfile {
  tenant_id: string;
  name: string;
  school_type: string | null;
  country: string | null;
  region: string | null;
  county: string | null;
  education_system: string | null;
  ownership_type: string | null;
  setup_stage: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  is_valid: boolean;
  subscription_status: string;
  subscription_expires_at: string | null;
  watermark_url: string | null;
  logo_url: string | null;
  motto: string | null;
  created_at: string;
}

export interface SchoolValidity {
  tenant_id: string;
  name: string;
  is_valid: boolean;
  subscription_status: string;
  subscription_expires_at: string | null;
  days_remaining: number | null;
  is_expired: boolean;
}

export interface TermDateRow {
  term_date_id: string;
  academic_year: number;
  term: string;
  opening_date: string;
  closing_date: string;
}

export interface ReportTemplateConfig {
  config_key: string;
  config_value: string;
}

export interface MessageLogRow {
  message_id: string;
  recipient_type: string;
  message_type: string;
  subject: string | null;
  message_body: string;
  recipient_count: number;
  credits_used: number;
  status: string;
  exam_id: string | null;
  exam_name: string | null;
  sent_at: string | null;
  created_at: string;
  sender_name: string | null;
}

export interface MessageRecipients {
  students: Array<{
    id: string;
    name: string | null;
    admission_no: string;
    class_name: string | null;
    stream_name: string | null;
    gender: string | null;
  }>;
  teachers: Array<{
    id: string;
    name: string | null;
    role: string | null;
    staff_type: string | null;
  }>;
  classes: Array<{ id: string; name: string }>;
  streams: Array<{ id: string; class_id: string; name: string }>;
}

export interface SmsGatewayConfig {
  tenant_id: string;
  gateway_type: string;
  description: string;
  companion_app: string;
  mechanism: string;
  required_permissions: string[];
  supports_dual_sim: boolean;
  supports_delivery_tracking: boolean;
  max_batch_size: number;
}

export interface PendingSmsRow {
  message_id: string;
  phone_numbers: string[];
  message_body: string;
  recipient_count: number;
  created_at: string;
}

export interface AttendanceRow {
  student_id: string;
  student_name: string | null;
  admission_no: string;
  status: string;
  remarks: string | null;
}

export interface BehaviourRow {
  id: string;
  student_id: string;
  behaviour_type: string;
  description: string | null;
  severity: string | null;
  recorded_by: string | null;
  recorded_at: string;
  action_taken: string | null;
}

export interface StudentNote {
  id: string;
  student_id: string;
  note_type: string;
  title: string | null;
  content: string;
  created_by: string | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface StudentMembership {
  kind: 'group' | 'residence';
  ref_id: string;
  name: string;
  detail: string | null;
}

export interface StudentGroup {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
}

export interface StudentResidence {
  id: string;
  name: string;
  residence_type: string;
  capacity: number | null;
  supervisor_name: string | null;
  occupant_count: number;
}

export interface SubjectPaper {
  id: string;
  subject_id: string;
  name: string;
  code: string | null;
  max_marks: number;
  weight: number;
  sort_order: number;
}

export interface Pathway {
  id: string;
  name: string;
  track: string | null;
  description: string | null;
}

export interface FeeStructure {
  structure_id: string;
  class_id: string | null;
  class_name: string | null;
  academic_year: number;
  term: string;
  name: string;
  amount: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FeePayment {
  payment_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  academic_year: number | null;
  term: string | null;
  notes: string | null;
  recorded_by_name: string | null;
  paid_by: string | null;
  paid_at: string;
}

export interface FeeLedgerEntry extends FeePayment {
  entry_type: 'payment' | 'reversal';
  reversal_reason: string | null;
  receipt_id: string | null;
  receipt_number: string | null;
}

export interface FeeBalance {
  student_id: string;
  student_name: string | null;
  admission_no: string;
  total_fees: number;
  total_paid: number;
  total_waived: number;
  balance: number;
}

export interface FeePledge {
  pledge_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  pledged_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface TimetableEntry {
  entry_id: string | null;
  slot_id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  slot_label: string | null;
  class_id: string | null;
  class_name: string | null;
  stream_id: string | null;
  stream_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  room: string | null;
  notes: string | null;
}

export interface EventRow {
  event_id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  is_all_day: boolean;
  created_by_name: string | null;
  created_at: string;
}

export interface NoticeRow {
  notice_id: string;
  title: string;
  content: string;
  notice_type: string;
  target_audience: string;
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface ClassWithStreams {
  class_id: string;
  class_name: string;
  stream_id: string | null;
  stream_name: string | null;
  student_count: number;
}

export interface SubjectWithDetails {
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  department: string;
  is_compulsory: boolean;
  paper_count: number;
}

export interface StaffDirectoryRow {
  staff_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  staff_type: string | null;
  is_active: boolean;
  class_count: number;
  created_at: string;
}

export interface CounsellingSession {
  session_id: string;
  student_id: string | null;
  student_name: string | null;
  admission_no: string | null;
  counsellor_name: string | null;
  session_date: string;
  session_type: string;
  topic: string | null;
  notes: string | null;
  outcome: string | null;
  follow_up_date: string | null;
  status: string;
}

export interface CounsellingReferral {
  referral_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  referred_by_name: string | null;
  reason: string;
  urgency: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface MedicalVisit {
  visit_id: string;
  student_id: string | null;
  student_name: string | null;
  admission_no: string | null;
  visit_date: string;
  complaint: string | null;
  diagnosis: string | null;
  treatment: string | null;
  referred_to: string | null;
  attended_by_name: string | null;
  status: string;
  notes: string | null;
}

export interface MedicalInventoryItem {
  item_id: string;
  item_name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  expiry_date: string | null;
  supplier: string | null;
}

export interface ParentStudentLink {
  link_id: string;
  parent_id: string;
  parent_name: string | null;
  parent_email: string | null;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  relationship: string;
  is_primary: boolean;
  created_at: string;
}

export interface ParentRow {
  parent_id: string;
  full_name: string | null;
  email: string | null;
  linked_students: number;
}

export interface Opportunity {
  opportunity_id: string;
  title: string;
  description: string | null;
  opportunity_type: string;
  eligibility_criteria: string | null;
  deadline: string | null;
  application_url: string | null;
  is_active: boolean;
  applicant_count: number;
  created_at: string;
}

export interface OpportunityApplication {
  application_id: string;
  opportunity_id: string;
  opportunity_title: string | null;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  status: string;
  notes: string | null;
  applied_at: string;
}

export interface ExamComment {
  comment_id: string;
  exam_id: string | null;
  exam_name: string | null;
  student_id: string | null;
  student_name: string | null;
  category_name: string | null;
  comment_text: string;
  comment_type: string;
  target_type: string;
  created_by_name: string | null;
  created_at: string;
}

export interface CommentCategory {
  category_id: string;
  name: string;
  category_type: string;
  description: string | null;
}

export interface Invoice {
  invoice_id: string;
  invoice_number: string;
  student_id: string | null;
  student_name: string | null;
  admission_no: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  due_date: string | null;
  issued_date: string;
  notes: string | null;
  created_at: string;
}

export interface Receipt {
  receipt_id: string;
  invoice_id: string | null;
  invoice_number: string | null;
  receipt_number: string;
  amount_paid: number;
  payment_method: string;
  reference_number: string | null;
  paid_at: string;
  recorded_by_name: string | null;
  payment_id: string | null;
  paid_by: string | null;
}

export interface Wallet {
  wallet_id: string;
  owner_id: string;
  balance: number;
  currency: string;
  owner_type: string;
}

export interface WalletTransaction {
  transaction_id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  reference_number: string | null;
  payment_method: string | null;
  created_at: string;
}

export interface VoteHead {
  vote_head_id: string;
  name: string;
  code: string | null;
  category_id: string | null;
  category_name: string | null;
  description: string | null;
  is_active: boolean;
}

export interface VoteHeadCategory {
  category_id: string;
  name: string;
  description: string | null;
}

export interface FeeStructureGroup {
  group_id: string;
  name: string;
  description: string | null;
}

export interface FeeCollection {
  collection_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  class_name: string | null;
  vote_head_name: string | null;
  amount: number;
  collection_type: string;
  payment_method: string | null;
  reference_number: string | null;
  academic_year: number | null;
  term: string | null;
  recorded_by_name: string | null;
  collected_at: string;
}

export interface ReversalReason {
  reason_id: string;
  reason: string;
  is_active: boolean;
}

export interface StudentVoteHeadBalance {
  vote_head_id: string;
  vote_head_name: string;
  vote_head_code: string | null;
  category_name: string | null;
  balance: number;
}

export interface ChartOfAccount {
  account_id: string;
  code: string;
  name: string;
  account_type: string;
  parent_id: string | null;
  parent_name: string | null;
  is_active: boolean;
  description: string | null;
}

export interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

export interface CashBookEntry {
  entry_id: string;
  entry_date: string;
  entry_type: string;
  amount: number;
  description: string;
  account_code: string | null;
  account_name: string | null;
  reference_number: string | null;
  payment_method: string | null;
  recorded_by_name: string | null;
  created_at: string;
}

export interface AuditEvent {
  event_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_values: Record<string, unknown> | null;
  after_values: Record<string, unknown> | null;
  reason: string | null;
  correlation_id: string | null;
  created_at: string;
}

export interface FeeWaiver {
  waiver_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  invoice_id: string | null;
  amount: number;
  reason: string;
  supporting_reference: string | null;
  status: string;
  requested_by_name: string | null;
  requested_at: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  applied_at: string | null;
}

export interface FiscalPeriod {
  period_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  closed_by_name: string | null;
  closed_at: string | null;
  close_reason: string | null;
  reopened_by_name: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
}

export interface Budget {
  budget_id: string;
  name: string;
  fiscal_period_id: string | null;
  fiscal_period_name: string | null;
  status: string;
  version: number;
  created_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
  line_count: number;
  total_budget: number;
}

export interface BudgetVsActual {
  line_id: string;
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  vote_head_id: string | null;
  vote_head_name: string | null;
  budget_type: string;
  budget_amount: number;
  actual_amount: number;
  variance: number;
  variance_pct: number | null;
}

export interface DailyAttendanceRow {
  student_id: string;
  student_name: string | null;
  admission_no: string;
  class_name: string | null;
  stream_name: string | null;
  status: string;
  absence_reason: string | null;
  arrival_time: string | null;
  remarks: string | null;
  recorded_at: string | null;
}

export interface AttendanceSummaryRow {
  student_id: string;
  student_name: string | null;
  admission_no: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  excused_days: number;
  sick_days: number;
  attendance_pct: number;
}

export interface EmergencyContact {
  contact_id: string;
  student_id: string;
  full_name: string;
  relationship: string;
  phone_primary: string;
  phone_secondary: string | null;
  email: string | null;
  is_primary: boolean;
  is_authorized_pickup: boolean;
  notes: string | null;
}

export interface MedicalAlert {
  alert_id: string;
  student_id: string;
  alert_type: string;
  description: string;
  severity: string;
  instructions: string | null;
  is_active: boolean;
  created_at: string;
}

export interface LeaveType {
  leave_type_id: string;
  name: string;
  description: string | null;
  max_days_per_year: number | null;
  is_paid: boolean;
  is_active: boolean;
}

export interface LeaveRequest {
  request_id: string;
  staff_id: string;
  staff_name: string | null;
  leave_type_id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: string;
  approved_by_name: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface DutyRoster {
  roster_id: string;
  duty_type: string;
  description: string | null;
  start_date: string;
  end_date: string;
  assignment_count: number;
}

export interface DutyAssignment {
  assignment_id: string;
  staff_id: string;
  staff_name: string | null;
  duty_date: string;
  duty_period: string | null;
  notes: string | null;
}

export interface Substitution {
  substitution_id: string;
  original_staff_id: string;
  original_staff_name: string | null;
  substitute_staff_id: string;
  substitute_staff_name: string | null;
  timetable_entry_id: string | null;
  substitution_date: string;
  reason: string | null;
  status: string;
}

export interface LessonPlan {
  plan_id: string;
  teacher_id: string | null;
  teacher_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  class_id: string | null;
  class_name: string | null;
  stream_id: string | null;
  stream_name: string | null;
  topic: string;
  subtopic: string | null;
  learning_objectives: string | null;
  intended_outcomes: string | null;
  learning_activities: string | null;
  teaching_resources: string | null;
  assessment_methods: string | null;
  teacher_notes: string | null;
  planned_date: string | null;
  duration_minutes: number | null;
  status: string;
  completion_pct: number;
  created_at: string;
}

export interface CurriculumCoverage {
  coverage_id: string;
  subject_id: string;
  subject_name: string | null;
  class_id: string | null;
  class_name: string | null;
  term: string;
  academic_year: number;
  curriculum_topic: string;
  curriculum_subtopic: string | null;
  is_planned: boolean;
  is_taught: boolean;
  taught_date: string | null;
  taught_by_name: string | null;
  notes: string | null;
}

export interface CurriculumCoverageSummary {
  subject_id: string;
  subject_name: string | null;
  class_id: string | null;
  class_name: string | null;
  total_topics: number;
  planned_topics: number;
  taught_topics: number;
  coverage_pct: number;
}

export interface TeacherWorkload {
  teacher_id: string;
  teacher_name: string | null;
  total_periods: number;
  total_hours: number;
  subject_count: number;
  class_count: number;
  duty_count: number;
  substitution_count: number;
}

export interface PayrollPeriod {
  period_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  created_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  finalized_at: string | null;
  entry_count: number;
}

export interface PayrollEntry {
  entry_id: string;
  staff_id: string;
  staff_name: string | null;
  basic_salary: number;
  gross_earnings: number;
  total_deductions: number;
  net_pay: number;
  employer_contributions: number;
  paye: number;
  nssf_employee: number;
  nssf_employer: number;
  sha_employee: number;
  ahl_employee: number;
  ahl_employer: number;
  status: string;
}

export interface SalaryComponent {
  component_id: string;
  name: string;
  component_type: string;
  calculation_type: string;
  default_amount: number | null;
  percentage_rate: number | null;
  is_taxable: boolean;
  is_pensionable: boolean;
  statutory_type: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
}

export interface SalaryComponent {
  component_id: string;
  name: string;
  component_type: string;
  calculation_type: string;
  default_amount: number | null;
  percentage_rate: number | null;
  is_taxable: boolean;
  is_pensionable: boolean;
  statutory_type: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
}

export interface EmployeeSalary {
  salary_id: string;
  staff_id: string;
  staff_name: string | null;
  basic_salary: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  component_count: number;
}

export interface DataRetentionPolicy {
  policy_id: string;
  entity_type: string;
  retention_days: number;
  action: string;
  is_active: boolean;
  created_at: string;
}

export interface LibraryBook {
  book_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  publisher: string | null;
  publication_year: number | null;
  total_copies: number;
  available_copies: number;
  location: string | null;
  is_active: boolean;
}

export interface BookLoan {
  loan_id: string;
  book_id: string;
  book_title: string | null;
  borrower_id: string;
  borrower_name: string | null;
  borrower_type: string;
  loan_date: string;
  due_date: string;
  return_date: string | null;
  status: string;
  fine_amount: number;
  fine_paid: boolean;
  is_overdue: boolean;
}

export interface Vehicle {
  vehicle_id: string;
  registration_number: string;
  vehicle_type: string;
  capacity: number;
  make: string | null;
  model: string | null;
  year: number | null;
  is_active: boolean;
}

export interface TransportRoute {
  route_id: string;
  name: string;
  description: string | null;
  vehicle_id: string | null;
  registration_number: string | null;
  driver_id: string | null;
  driver_name: string | null;
  pickup_points: string | null;
  departure_time: string | null;
  return_time: string | null;
  is_active: boolean;
  student_count: number;
}

export interface StudentTransport {
  assignment_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  route_id: string;
  route_name: string | null;
  pickup_point: string | null;
  is_active: boolean;
}

export interface StudentTransport {
  assignment_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  route_id: string;
  route_name: string | null;
  pickup_point: string | null;
  is_active: boolean;
}

export interface MealPlan {
  plan_id: string;
  residence_id: string | null;
  residence_name: string | null;
  meal_date: string;
  meal_type: string;
  menu: string | null;
  present_count: number;
  absent_count: number;
}

export interface BoardingRollCall {
  roll_call_id: string;
  residence_id: string;
  residence_name: string | null;
  roll_call_date: string;
  roll_call_time: string;
  roll_call_type: string;
  present_count: number;
  absent_count: number;
  total_count: number;
}

export interface Sport {
  sport_id: string;
  name: string;
  description: string | null;
  sport_type: string;
  is_active: boolean;
  event_count: number;
}

export interface SportsEvent {
  event_id: string;
  sport_id: string | null;
  sport_name: string | null;
  title: string;
  event_date: string;
  event_type: string;
  venue: string | null;
  opponent: string | null;
  result: string | null;
  score: string | null;
  participant_count: number;
}

export interface SportsParticipation {
  participation_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  role: string;
  performance_notes: string | null;
}

export interface Trip {
  trip_id: string;
  title: string;
  description: string | null;
  trip_type: string;
  destination: string;
  start_date: string;
  end_date: string;
  departure_time: string | null;
  return_time: string | null;
  transport_mode: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  status: string;
  participant_count: number;
  permission_slip_count: number;
  created_at: string;
}

export interface TripParticipant {
  participant_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  permission_slip_signed: boolean;
  permission_slip_date: string | null;
  payment_status: string;
  amount_paid: number;
  notes: string | null;
}

export interface BankStatement {
  statement_id: string;
  account_name: string;
  bank_name: string | null;
  statement_date: string;
  opening_balance: number;
  closing_balance: number;
  file_name: string | null;
  status: string;
  imported_by_name: string | null;
  imported_at: string;
  line_count: number;
  matched_count: number;
  unmatched_count: number;
}

export interface BankStatementLine {
  line_id: string;
  transaction_date: string;
  description: string | null;
  reference_number: string | null;
  debit: number;
  credit: number;
  amount: number;
  direction: string;
  match_status: string;
  matched_payment_id: string | null;
  matched_collection_id: string | null;
  is_duplicate: boolean;
  match_notes: string | null;
}

export interface ExamOption {
  id: string;
  name: string;
  term: string | null;
  academic_year: number | null;
  assessment_component: string | null;
  status: string;
  published_at: string | null;
}

export interface ClassOption {
  id: string;
  name: string;
}

export interface StreamOption {
  id: string;
  class_id: string;
  name: string;
}

export interface AnalyticsSelection {
  academicYear: string;
  examId: string;
  classId: string;
  streamId: string;
}
