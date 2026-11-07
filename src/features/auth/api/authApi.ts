/** auth API — Supabase RPC calls for the auth feature. */

import { parentRpc } from '../../../shared/api/request';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { ParentPreferences } from '../../../shared/types/contracts';

export async function getMyPreferences(options: RequestOptions = {}): Promise<ParentPreferences> {
  const rows = await parentRpc<Record<string, unknown>>('get_my_preferences', undefined, options);
  const r = rows[0] ?? {};
  return {
    homeworkDueTomorrow: r.homework_due_tomorrow !== false,
    eventReminders: r.event_reminders !== false,
    replyNotifications: r.reply_notifications !== false,
    smsHomeworkDueTomorrow: r.sms_homework_due_tomorrow === true,
    smsEventReminders: r.sms_event_reminders === true,
    smsReplyNotifications: r.sms_reply_notifications === true,
  };
}

export async function setMyPreferences(prefs: ParentPreferences): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('set_my_preferences', {
    p_homework_due_tomorrow: prefs.homeworkDueTomorrow,
    p_event_reminders: prefs.eventReminders,
    p_reply_notifications: prefs.replyNotifications,
    p_sms_homework_due_tomorrow: prefs.smsHomeworkDueTomorrow,
    p_sms_event_reminders: prefs.smsEventReminders,
    p_sms_reply_notifications: prefs.smsReplyNotifications,
  });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
}

/** The number saved by setMyPhone, or null when none is saved. */
export async function getMyPhone(): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_my_phone');
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  return typeof data === 'string' && data !== '' ? data : null;
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
