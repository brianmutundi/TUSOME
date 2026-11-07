/** staff API — Supabase RPC calls for the staff feature. */

import { throwIfAborted } from '../../../shared/api/request';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { AnalyticsContractError, normalizeStaffGroups, normalizeTeacherAllocations, normalizeTeacherDirectory, normalizeTeacherSubjectClassPerformance } from '@/lib/analytics/guards';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { DutyAssignment, DutyRoster, LeaveRequest, LeaveType, StaffDirectoryRow, StaffGroupRow, StaffType, Substitution, TeacherAllocationRow, TeacherAllocationType, TeacherDirectoryRow, TeacherSubjectClassPerformanceRow, TeacherWorkload } from '@/lib/analytics/types';

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
