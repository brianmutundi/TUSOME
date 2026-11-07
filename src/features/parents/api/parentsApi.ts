/** parents API — Supabase RPC calls for the parents feature. */

import { throwIfAborted } from '../../../shared/api/request';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { ParentRow, ParentStudentLink } from '@/lib/analytics/types';

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
    parent_phone: raw.parent_phone ? String(raw.parent_phone) : null,
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
