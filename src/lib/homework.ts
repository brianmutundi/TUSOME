import { AnalyticsAPIError } from '@/lib/analytics/errors';

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" as a local calendar date (new Date("YYYY-MM-DD") would be UTC midnight). */
export function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local calendar day as "YYYY-MM-DD". */
export function toDateOnly(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole days from today to the due date (negative = overdue). Unreadable dates count as today. */
export function homeworkDaysUntil(dueDate: string, now: Date = new Date()): number {
  const due = parseDateOnly(dueDate);
  if (!due) return 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / DAY_MS);
}

export function homeworkDueLabel(dueDate: string, now: Date = new Date()): string {
  const days = homeworkDaysUntil(dueDate, now);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return '1 day overdue';
  return days > 0 ? `Due in ${days} days` : `${-days} days overdue`;
}

export interface HomeworkSplit<T> {
  /** Not ticked, due today or later; soonest first. */
  todo: T[];
  /** Not ticked, due before today; oldest first. */
  overdue: T[];
  /** Ticked; latest due date first. */
  done: T[];
}

export function splitHomework<T extends { dueDate: string; isDone: boolean }>(items: T[], now: Date = new Date()): HomeworkSplit<T> {
  const byDue = (a: T, b: T) => a.dueDate.localeCompare(b.dueDate);
  const open = items.filter((h) => !h.isDone);
  return {
    todo: open.filter((h) => homeworkDaysUntil(h.dueDate, now) >= 0).sort(byDue),
    overdue: open.filter((h) => homeworkDaysUntil(h.dueDate, now) < 0).sort(byDue),
    done: items.filter((h) => h.isDone).sort((a, b) => byDue(b, a)),
  };
}

/** What the Homework nav badge shows: items not ticked and not yet overdue. */
export function homeworkTodoCount(items: { dueDate: string; isDone: boolean }[] | null, now: Date = new Date()): number {
  if (!items) return 0;
  return items.filter((h) => !h.isDone && homeworkDaysUntil(h.dueDate, now) >= 0).length;
}

// Messages the homework RPCs raise on purpose; anything else is not shown raw.
const KNOWN_MESSAGES = [
  'Title is required',
  'Instructions are limited',
  'Due date is required',
  'Due date cannot be in the past',
  'Stream does not belong',
  'Class not found',
  'Subject not found',
  'Homework not found',
  'Access denied: not allocated',
  'Access denied: you can only change',
];

/** Turns an error from a homework call into text safe to show a person. */
export function homeworkErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AnalyticsAPIError) {
    // 42501 errors arrive with a generic message; the server's own text is in serverMessage.
    const text = error.serverMessage ?? error.message;
    if (KNOWN_MESSAGES.some((m) => text.startsWith(m))) return text;
    if (error.code === 'ACCESS_DENIED') return 'You do not have access to do that.';
  }
  return fallback;
}

/** True when the server refused the read because this link does not include academics. */
export function isAccessDenied(error: unknown): boolean {
  return error instanceof AnalyticsAPIError && error.code === 'ACCESS_DENIED';
}
