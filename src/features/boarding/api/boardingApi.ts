/** boarding API — Supabase RPC calls for the boarding feature. */

import { throwIfAborted } from '../../../shared/api/request';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { BoardingRollCall, MealPlan } from '@/lib/analytics/types';

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
