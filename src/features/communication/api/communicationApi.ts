/** communication API — Supabase RPC calls for the communication feature. */

import { throwIfAborted } from '../../../shared/api/request';
import { mapThreadMessage, toAudience } from '../../../shared/api/threads';
import { textOrNull } from '../../../shared/utils/text';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { AnalyticsContractError, normalizeMessageLog, normalizeMessageRecipients, normalizePendingSms } from '@/lib/analytics/guards';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { InboxThread, ThreadMessage } from '../../../shared/types/contracts';
import type { MessageLogRow, MessageRecipients, NoticeRow, PendingSmsRow, SmsGatewayConfig } from '@/lib/analytics/types';

export async function listParentThreads(options: RequestOptions = {}): Promise<InboxThread[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('list_parent_threads', { p_status: null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
    threadId: String(r.thread_id),
    studentId: String(r.student_id),
    studentName: String(r.student_name ?? ''),
    admissionNo: String(r.admission_no ?? ''),
    className: textOrNull(r.class_name),
    parentName: textOrNull(r.parent_name),
    relationship: textOrNull(r.relationship),
    audience: toAudience(r.audience),
    subject: String(r.subject ?? ''),
    status: r.status === 'closed' ? 'closed' : 'open',
    flagged: r.flagged === true,
    lastMessageAt: String(r.last_message_at ?? ''),
    lastMessagePreview: String(r.last_message_preview ?? ''),
    lastSenderKind: r.last_sender_kind === 'staff' ? 'staff' : r.last_sender_kind === 'parent' ? 'parent' : null,
    isUnread: r.is_unread === true,
    createdAt: String(r.created_at ?? ''),
  }));
}

export async function getParentThreadMessages(threadId: string, options: RequestOptions = {}): Promise<ThreadMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_parent_thread_messages', { p_thread_id: threadId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map(mapThreadMessage);
}

export async function replyParentThread(threadId: string, body: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('reply_parent_thread', { p_thread_id: threadId, p_body: body });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
}

export async function closeParentThread(threadId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('close_parent_thread', { p_thread_id: threadId });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
}

export async function setParentThreadFlag(threadId: string, flagged: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('set_parent_thread_flag', { p_thread_id: threadId, p_flagged: flagged });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
}

export async function markParentThreadReadStaff(threadId: string, seenUpTo: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('mark_parent_thread_read_staff', { p_thread_id: threadId, p_seen_up_to: seenUpTo });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
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
  options: RequestOptions & { documentId?: string | null } = {}
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
      p_document_id: options.documentId || null,
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
