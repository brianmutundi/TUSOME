import type { EventRow } from '@/lib/analytics/types';
import type {
  MyChildAttendanceCount,
  MyChildFeeLine,
  MyChildLesson,
  MyChildResult,
} from '@/lib/analytics/api';

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days from `now` to `iso` (negative = past). NaN dates give 0. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return 0;
  return Math.round((startOfDay(t) - startOfDay(now)) / DAY_MS);
}

export function relativeDayLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

/** Events that have not ended yet, soonest first. */
export function upcomingEvents(events: EventRow[], now: Date = new Date()): EventRow[] {
  const today = startOfDay(now);
  return events
    .filter((e) => startOfDay(new Date(e.end_date ?? e.start_date)) >= today)
    .sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date));
}

/** Sum of positive balances; credits on one vote head do not offset another. */
export function owedTotal(fees: MyChildFeeLine[]): number {
  return fees.reduce((sum, line) => sum + Math.max(line.balance, 0), 0);
}

export interface FeeTotals {
  billed: number;
  waived: number;
  paid: number;
  owed: number;
  /** Share of the payable amount (billed less waived) already paid, 0 to 100. */
  percentPaid: number;
}

/** Term totals across all fee lines. Overpaid lines do not hide a balance on another. */
export function feeTotals(fees: MyChildFeeLine[]): FeeTotals {
  const billed = fees.reduce((sum, l) => sum + l.charged, 0);
  const waived = fees.reduce((sum, l) => sum + l.waived, 0);
  const paid = fees.reduce((sum, l) => sum + l.paid, 0);
  const payable = billed - waived;
  const percentPaid = payable > 0 ? Math.min(100, Math.max(0, (paid / payable) * 100)) : 0;
  return { billed, waived, paid, owed: owedTotal(fees), percentPaid };
}

/** A mark as a 0 to 100 percentage of its own maximum. */
export function scorePercent(r: Pick<MyChildResult, 'score' | 'maxScore'>): number {
  if (!(r.maxScore > 0)) return 0;
  return Math.min(100, Math.max(0, (r.score / r.maxScore) * 100));
}

/** "78" when out of 100, "39/50" otherwise. */
export function formatScore(r: Pick<MyChildResult, 'score' | 'maxScore'>): string {
  return r.maxScore === 100 ? String(r.score) : `${r.score}/${r.maxScore}`;
}

export interface ExamGroup {
  examId: string;
  name: string;
  term: string | null;
  year: number | null;
  rows: MyChildResult[];
  /** Mean of the subject percentages, so papers with different maximums compare fairly. */
  average: number | null;
  strongest: MyChildResult | null;
}

/** Group result rows by exam, keeping the server's newest-first order. */
export function groupResults(results: MyChildResult[]): ExamGroup[] {
  const map = new Map<string, ExamGroup>();
  for (const r of results) {
    const g =
      map.get(r.examId) ??
      { examId: r.examId, name: r.examName, term: r.term, year: r.academicYear, rows: [], average: null, strongest: null };
    g.rows.push(r);
    map.set(r.examId, g);
  }
  return Array.from(map.values()).map((g) => {
    const total = g.rows.reduce((s, r) => s + scorePercent(r), 0);
    const strongest = g.rows.reduce<MyChildResult | null>(
      (best, r) => (best === null || scorePercent(r) > scorePercent(best) ? r : best),
      null
    );
    return { ...g, average: g.rows.length ? total / g.rows.length : null, strongest };
  });
}

export function attendanceDays(counts: MyChildAttendanceCount[], status: string): number {
  return counts.find((c) => c.status.toLowerCase() === status)?.days ?? 0;
}

/** Accepts 07XX / 01XX XXX XXX and +2547XX / +2541XX; the server normalises. */
export function isKenyanPhone(input: string): boolean {
  const n = input.replace(/[\s-]/g, '');
  return /^(07|01)\d{8}$/.test(n) || /^\+254(7|1)\d{8}$/.test(n);
}

/** Shows a stored number (254712345678) the way parents type it (0712 345 678); anything else is returned unchanged. */
export function formatSavedPhone(stored: string): string {
  const n = stored.replace(/[\s-]/g, '').replace(/^\+/, '');
  const m = /^254([71]\d{8})$/.exec(n) ?? /^0([71]\d{8})$/.exec(n);
  if (!m) return stored;
  const d = m[1];
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Opens a token-backed document (receipt, statement) in a new tab. The tab is
 * opened synchronously inside the click so popup blockers allow it, then pointed
 * at the document once the token arrives.
 */
export async function openShareDocument(
  getToken: () => Promise<string>,
  pathFor: (token: string) => string
): Promise<void> {
  const win = window.open('', '_blank');
  if (win) win.opener = null;
  try {
    const url = pathFor(await getToken());
    if (win) win.location.href = url;
    else window.location.assign(url);
  } catch (error) {
    win?.close();
    throw error;
  }
}

/** Day indices as the server stores them: 0 = Sunday ... 6 = Saturday. */
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Tab for a parent opening the timetable: today, or Monday on a weekend. */
export function defaultTimetableDay(now: Date = new Date()): number {
  const d = now.getDay();
  return d === 0 || d === 6 ? 1 : d;
}

/** Monday to Friday always, plus Saturday or Sunday only when the school has lessons then. Monday-first order. */
export function timetableTabDays(lessons: MyChildLesson[]): number[] {
  const days = new Set([1, 2, 3, 4, 5]);
  for (const l of lessons) if (l.dayOfWeek >= 0 && l.dayOfWeek <= 6) days.add(l.dayOfWeek);
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.filter((d) => days.has(d));
}

/** Lessons on one day in teaching order. */
export function lessonsForDay(lessons: MyChildLesson[], day: number): MyChildLesson[] {
  return lessons
    .filter((l) => l.dayOfWeek === day)
    .sort((a, b) => a.periodNumber - b.periodNumber || a.startTime.localeCompare(b.startTime));
}

function minutesOf(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** True while `now` is inside the lesson (start inclusive, end exclusive) on that lesson's weekday. */
export function isLessonNow(lesson: MyChildLesson, now: Date = new Date()): boolean {
  if (now.getDay() !== lesson.dayOfWeek) return false;
  const start = minutesOf(lesson.startTime);
  const end = minutesOf(lesson.endTime);
  if (start === null || end === null) return false;
  const t = now.getHours() * 60 + now.getMinutes();
  return t >= start && t < end;
}

/** What to call a lesson: its subject, else the slot's label, else a free period. */
export function lessonTitle(lesson: MyChildLesson): string {
  return lesson.subjectName ?? lesson.slotLabel ?? 'Free period';
}
