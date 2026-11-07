/** parent-portal API — Supabase RPC calls for the parent-portal feature. */

import { parentRpc, throwIfAborted } from '../../../shared/api/request';
import { mapThreadMessage, toAudience } from '../../../shared/api/threads';
import { textOrNull } from '../../../shared/utils/text';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { AnalyticsContractError } from '@/lib/analytics/guards';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { ParentReceipt, ThreadAudience, ThreadMessage } from '../../../shared/types/contracts';

export interface MyChild {
  studentId: string;
  fullName: string;
  admissionNo: string;
  className: string | null;
  relationship: string;
  isPrimary: boolean;
  classId: string | null;
  streamId: string | null;
  streamName: string | null;
}

export interface MyChildFeeLine {
  voteHeadId: string;
  voteHeadName: string;
  /** Billed for the current term. */
  charged: number;
  paid: number;
  waived: number;
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
  /** Marks the score is out of; 100 unless the paper says otherwise. */
  maxScore: number;
}

export interface MyChildAttendanceCount {
  status: string;
  days: number;
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
    classId: typeof r.class_id === 'string' ? r.class_id : null,
    streamId: typeof r.stream_id === 'string' ? r.stream_id : null,
    streamName: typeof r.stream_name === 'string' ? r.stream_name : null,
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
    charged: Number(r.charged ?? 0),
    paid: Number(r.paid ?? 0),
    waived: Number(r.waived ?? 0),
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
    maxScore: Number(r.max_score) > 0 ? Number(r.max_score) : 100,
  }));
}

/** A notice as served to a parent: published, unexpired, with a server-side read flag. */
export interface ParentNotice {
  noticeId: string;
  title: string;
  content: string;
  noticeType: string;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  isRead: boolean;
}

export async function getMyNotices(options: RequestOptions = {}): Promise<ParentNotice[]> {
  const rows = await parentRpc<Record<string, unknown>>('get_my_notices', undefined, options);
  return rows.map((r) => ({
    noticeId: String(r.notice_id ?? ''),
    title: String(r.title ?? ''),
    content: String(r.content ?? ''),
    noticeType: String(r.notice_type ?? 'general'),
    publishedAt: typeof r.published_at === 'string' ? r.published_at : null,
    expiresAt: typeof r.expires_at === 'string' ? r.expires_at : null,
    createdAt: String(r.created_at ?? ''),
    isRead: r.is_read === true,
  }));
}

export async function markNoticesRead(noticeIds: string[], options: RequestOptions = {}): Promise<void> {
  if (noticeIds.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .rpc('mark_notices_read', { p_notice_ids: noticeIds })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
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

/** One lesson in a child's weekly timetable. */
export interface MyChildLesson {
  entryId: string;
  /** 0 = Sunday ... 6 = Saturday, like Date.getDay(). */
  dayOfWeek: number;
  periodNumber: number;
  /** "HH:MM" (seconds from the server are dropped). */
  startTime: string;
  endTime: string;
  slotLabel: string | null;
  subjectName: string | null;
  teacherName: string | null;
  room: string | null;
}

const clock = (v: unknown): string => String(v ?? '').slice(0, 5);

export async function getMyChildTimetable(
  studentId: string,
  options: RequestOptions = {}
): Promise<MyChildLesson[]> {
  const rows = await parentRpc<Record<string, unknown>>('get_my_child_timetable', { p_student_id: studentId }, options);
  return rows.map((r) => ({
    entryId: String(r.entry_id),
    dayOfWeek: Number(r.day_of_week ?? 0),
    periodNumber: Number(r.period_number ?? 0),
    startTime: clock(r.start_time),
    endTime: clock(r.end_time),
    slotLabel: textOrNull(r.slot_label),
    subjectName: textOrNull(r.subject_name),
    teacherName: textOrNull(r.teacher_name),
    room: textOrNull(r.room),
  }));
}

export interface MyChildPaybill {
  /** Null until the school has set its paybill number. */
  paybillNumber: string | null;
  /** The child's admission number: what the parent types as the M-Pesa account. */
  accountNumber: string;
  schoolName: string;
}

export async function getMyChildPaybill(
  studentId: string,
  options: RequestOptions = {}
): Promise<MyChildPaybill> {
  const rows = await parentRpc<Record<string, unknown>>('get_my_child_paybill', { p_student_id: studentId }, options);
  const r = rows[0];
  if (!r) throw new Error('Payment details are not available.');
  return {
    paybillNumber: textOrNull(r.paybill_number),
    accountNumber: String(r.account_number ?? ''),
    schoolName: String(r.school_name ?? ''),
  };
}

/** One homework item as a parent sees it. */
export interface MyChildHomework {
  assignmentId: string;
  subjectName: string;
  title: string;
  instructions: string | null;
  /** Calendar date "YYYY-MM-DD" (school day, no time zone). */
  dueDate: string;
  teacherName: string | null;
  /** The parent's own tick. Never a teacher's judgement. */
  isDone: boolean;
  doneAt: string | null;
}

export async function getMyChildHomework(
  studentId: string,
  options: RequestOptions = {}
): Promise<MyChildHomework[]> {
  const rows = await parentRpc<Record<string, unknown>>('get_my_child_homework', { p_student_id: studentId }, options);
  return rows.map((r) => ({
    assignmentId: String(r.assignment_id),
    subjectName: String(r.subject_name ?? ''),
    title: String(r.title ?? ''),
    instructions: textOrNull(r.instructions),
    dueDate: String(r.due_date ?? '').slice(0, 10),
    teacherName: textOrNull(r.teacher_name),
    isDone: r.is_done === true,
    doneAt: typeof r.done_at === 'string' ? r.done_at : null,
  }));
}

export async function setMyChildHomeworkDone(
  assignmentId: string,
  studentId: string,
  done: boolean,
  options: RequestOptions = {}
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .rpc('set_my_child_homework_done', { p_assignment_id: assignmentId, p_student_id: studentId, p_done: done })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
}

/** Per child: may this parent message the school, and who is the class teacher right now. */
export interface MyMessageOption {
  studentId: string;
  canMessageSchool: boolean;
  /** null when the class has no active class teacher: such messages go to the school office. */
  classTeacherName: string | null;
}

export interface MyThread {
  threadId: string;
  studentId: string;
  studentName: string;
  /** Where the thread was actually routed (a class-teacher thread may have fallen back to admin). */
  audience: ThreadAudience;
  subject: string;
  status: 'open' | 'closed';
  closedAt: string | null;
  /** Closed less than 14 days ago, so the parent may reopen it. */
  canReopen: boolean;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastSenderKind: 'parent' | 'staff' | null;
  /** A staff reply the parent has not seen yet. */
  isUnread: boolean;
  createdAt: string;
}

export async function getMyMessageOptions(options: RequestOptions = {}): Promise<MyMessageOption[]> {
  const rows = await parentRpc<Record<string, unknown>>('get_my_message_options', undefined, options);
  return rows.map((r) => ({
    studentId: String(r.student_id),
    canMessageSchool: r.can_message_school === true,
    classTeacherName: textOrNull(r.class_teacher_name),
  }));
}

export async function getMyThreads(options: RequestOptions = {}): Promise<MyThread[]> {
  const rows = await parentRpc<Record<string, unknown>>('get_my_threads', undefined, options);
  return rows.map((r) => ({
    threadId: String(r.thread_id),
    studentId: String(r.student_id),
    studentName: String(r.student_name ?? ''),
    audience: toAudience(r.audience),
    subject: String(r.subject ?? ''),
    status: r.status === 'closed' ? 'closed' : 'open',
    closedAt: textOrNull(r.closed_at),
    canReopen: r.can_reopen === true,
    lastMessageAt: String(r.last_message_at ?? ''),
    lastMessagePreview: String(r.last_message_preview ?? ''),
    lastSenderKind: r.last_sender_kind === 'staff' ? 'staff' : r.last_sender_kind === 'parent' ? 'parent' : null,
    isUnread: r.is_unread === true,
    createdAt: String(r.created_at ?? ''),
  }));
}

export async function getMyThreadMessages(threadId: string, options: RequestOptions = {}): Promise<ThreadMessage[]> {
  const rows = await parentRpc<Record<string, unknown>>('get_my_thread_messages', { p_thread_id: threadId }, options);
  return rows.map(mapThreadMessage);
}

export async function createMyThread(input: {
  studentId: string;
  audience: ThreadAudience;
  subject: string;
  body: string;
}): Promise<{ threadId: string; audience: ThreadAudience }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('create_my_thread', {
    p_student_id: input.studentId,
    p_audience: input.audience,
    p_subject: input.subject,
    p_body: input.body,
  });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined;
  if (!row || typeof row.new_thread_id !== 'string') throw new Error('Message was not sent.');
  return { threadId: row.new_thread_id, audience: toAudience(row.routed_audience) };
}

export async function sendMyThreadMessage(threadId: string, body: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('send_my_thread_message', { p_thread_id: threadId, p_body: body });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
}

export async function reopenMyThread(threadId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('reopen_my_thread', { p_thread_id: threadId });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
}

/** Marks a thread read up to the newest message the parent saw (ISO time); null = now. */
export async function markMyThreadRead(threadId: string, seenUpTo: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('mark_my_thread_read', { p_thread_id: threadId, p_seen_up_to: seenUpTo });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
}

export async function getMyChildReceipts(
  studentId: string,
  options: RequestOptions = {}
): Promise<ParentReceipt[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_my_child_receipts', { p_student_id: studentId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []) as ParentReceipt[];
}

export async function createMyChildReceiptToken(
  receiptId: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_my_child_receipt_token', { p_receipt_id: receiptId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) throw new AnalyticsContractError('create_my_child_receipt_token');
  return data;
}

export async function createMyChildStatementToken(
  studentId: string,
  term?: string,
  academicYear?: number,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_my_child_statement_token', { p_student_id: studentId, p_term: term ?? null, p_academic_year: academicYear ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) throw new AnalyticsContractError('create_my_child_statement_token');
  return data;
}

export async function createMyChildReportToken(
  studentId: string,
  examId: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_my_child_report_token', { p_student_id: studentId, p_exam_id: examId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) throw new AnalyticsContractError('create_my_child_report_token');
  return data;
}
