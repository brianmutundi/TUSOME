/** students API — Supabase RPC calls for the students feature. */

import { throwIfAborted } from '../../../shared/api/request';
import { getParentStudentLinks } from '../../parents/api/parentsApi';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { AnalyticsContractError, normalizeStudentDirectory, normalizeStudentGroups, normalizeStudentMemberships, normalizeStudentNotes, normalizeStudentProfile, normalizeStudentResidences } from '@/lib/analytics/guards';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { StudentDirectoryRow, StudentGroup, StudentMembership, StudentNote, StudentProfileData, StudentResidence } from '@/lib/analytics/types';

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
  // Single source: parent_student_links (extended with parent_phone),
  // plus the student record's own guardian/phone fields.
  const links = await getParentStudentLinks(studentId, undefined, options);
  const out: GuardianContact[] = links.map((l) => ({
    guardian_name: l.parent_name,
    guardian_phone: l.parent_phone,
    relationship: l.relationship,
    is_primary: l.is_primary,
    source: 'linked',
  }));
  // student record fallback: fetch student phones
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('students')
      .select('guardian_name, guardian_relation, primary_phone, primary_phone_2, secondary_phone, secondary_phone_2')
      .eq('id', studentId)
      .maybeSingle();
    if (data && data.guardian_name) {
      const phone = data.primary_phone || data.primary_phone_2 || data.secondary_phone || data.secondary_phone_2 || null;
      out.push({
        guardian_name: data.guardian_name,
        guardian_phone: phone,
        relationship: data.guardian_relation || 'guardian',
        is_primary: out.length === 0,
        source: 'student_record',
      });
    }
  } catch { /* ignore */ }
  return out;
}
