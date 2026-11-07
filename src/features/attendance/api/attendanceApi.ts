/** attendance API — Supabase RPC calls for the attendance feature. */

import { throwIfAborted } from '../../../shared/api/request';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { AttendanceSummaryRow, DailyAttendanceRow } from '@/lib/analytics/types';

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
