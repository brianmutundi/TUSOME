import { AnalyticsAPIError } from '@/lib/analytics/errors';
import type { ThreadAudience } from '@/lib/analytics/api';

/** Same limits the database enforces. */
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_SUBJECT_LENGTH = 120;

export function audienceLabel(audience: ThreadAudience): string {
  if (audience === 'bursar') return 'Bursar';
  if (audience === 'admin') return 'School office';
  return 'Class teacher';
}

/** True when the text, once trimmed, is a sendable message (1 to 1000 characters). */
export function isSendableBody(text: string): boolean {
  const n = text.trim().length;
  return n >= 1 && n <= MAX_MESSAGE_LENGTH;
}

export function isSendableSubject(text: string): boolean {
  const n = text.trim().length;
  return n >= 1 && n <= MAX_SUBJECT_LENGTH;
}

/** Threads with a staff reply the parent has not opened. */
export function unreadThreadCount(threads: { isUnread: boolean }[] | null): number {
  if (!threads) return 0;
  return threads.filter((t) => t.isUnread).length;
}

/** One line of text for a list row: newlines and runs of spaces collapse to single spaces. */
export function previewText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The newest createdAt (ISO) among messages, or null when there are none. */
export function newestMessageTime(messages: { createdAt: string }[]): string | null {
  let best: { iso: string; ms: number } | null = null;
  for (const m of messages) {
    const ms = Date.parse(m.createdAt);
    if (Number.isNaN(ms)) continue;
    if (best === null || ms > best.ms) best = { iso: m.createdAt, ms };
  }
  return best?.iso ?? null;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2:05 pm" in the device's local time. */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

/** List-row time: the clock today, "Yesterday", a weekday within the last week, else "3 Nov". */
export function formatThreadTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return formatClock(iso);
  if (days === 1) return 'Yesterday';
  if (days < 7) return WEEKDAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Message-bubble time: the clock today, otherwise "3 Nov, 2:05 pm". */
export function formatMessageTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (startOfDay(now) === startOfDay(d)) return formatClock(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${formatClock(iso)}`;
}

// Messages the messaging RPCs raise on purpose (default error code, so the text reaches us).
const KNOWN_MESSAGES = [
  'Choose who to message',
  'Subject is required',
  'Message is required',
  'You have reached today',
  'This conversation is closed',
  'This conversation was closed more than 14 days ago',
  'Invalid status filter',
];

/** Turns an error from a messaging call into text that is safe to show a person. */
export function messagesErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AnalyticsAPIError) {
    if (KNOWN_MESSAGES.some((m) => error.message.startsWith(m))) return error.message;
    if (error.code === 'NOT_FOUND') return 'That conversation is no longer available.';
    if (error.code === 'ACCESS_DENIED') return 'You do not have access to do that.';
  }
  return fallback;
}

/** True when the server refused because the school has not allowed messaging for this link. */
export function isMessagingDenied(error: unknown): boolean {
  return error instanceof AnalyticsAPIError && error.code === 'ACCESS_DENIED';
}
