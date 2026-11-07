import { describe, expect, it } from 'vitest';
import type { MyChildFeeLine, MyChildLesson } from '@/lib/analytics/api';
import type { EventRow } from '@/lib/analytics/types';
import {
  attendanceDays,
  daysUntil,
  defaultTimetableDay,
  feeTotals,
  firstName,
  formatScore,
  groupResults,
  initials,
  formatSavedPhone,
  isKenyanPhone,
  isLessonNow,
  lessonTitle,
  lessonsForDay,
  owedTotal,
  relativeDayLabel,
  scorePercent,
  timetableTabDays,
  upcomingEvents,
} from './portal';

const NOW = new Date(2026, 10, 5, 9, 0);

const event = (o: Partial<EventRow>): EventRow => ({
  event_id: 'e', title: 'e', description: null, event_type: 'general', start_date: '2026-11-12T08:00:00',
  end_date: null, location: null, is_all_day: false, created_by_name: null, created_at: '2026-10-01T00:00:00Z', ...o,
});

describe('daysUntil / relativeDayLabel', () => {
  it('counts calendar days regardless of time of day', () => {
    expect(daysUntil('2026-11-05T23:59:00', NOW)).toBe(0);
    expect(daysUntil('2026-11-06T00:01:00', NOW)).toBe(1);
    expect(daysUntil('2026-11-02T12:00:00', NOW)).toBe(-3);
  });
  it('labels days', () => {
    expect(relativeDayLabel(0)).toBe('Today');
    expect(relativeDayLabel(1)).toBe('Tomorrow');
    expect(relativeDayLabel(7)).toBe('In 7 days');
    expect(relativeDayLabel(-2)).toBe('2 days ago');
  });
  it('treats invalid dates as today', () => {
    expect(daysUntil('nope', NOW)).toBe(0);
  });
});

describe('upcomingEvents', () => {
  it('drops finished events, keeps multi-day events still running, sorts ascending', () => {
    const out = upcomingEvents(
      [
        event({ event_id: 'later', start_date: '2026-11-20T08:00:00' }),
        event({ event_id: 'past', start_date: '2026-11-01T08:00:00' }),
        event({ event_id: 'running', start_date: '2026-11-03T08:00:00', end_date: '2026-11-06T17:00:00' }),
        event({ event_id: 'today', start_date: '2026-11-05T06:00:00' }),
      ],
      NOW
    );
    expect(out.map((e) => e.event_id)).toEqual(['running', 'today', 'later']);
  });
});

const line = (o: Partial<MyChildFeeLine>): MyChildFeeLine => ({
  voteHeadId: 'v', voteHeadName: 'Tuition', charged: 0, paid: 0, waived: 0, balance: 0, ...o,
});

describe('owedTotal', () => {
  it('ignores credit balances', () => {
    expect(owedTotal([line({ voteHeadId: 'a', balance: 1500 }), line({ voteHeadId: 'b', voteHeadName: 'Lunch', balance: -200 })])).toBe(1500);
    expect(owedTotal([])).toBe(0);
  });
});

describe('feeTotals', () => {
  it('sums billed, paid and waived and computes the share paid of the payable amount', () => {
    const t = feeTotals([
      line({ voteHeadId: 'a', charged: 10000, paid: 4000, waived: 1000, balance: 5000 }),
      line({ voteHeadId: 'b', voteHeadName: 'Lunch', charged: 2000, paid: 1000, balance: 1000 }),
    ]);
    expect(t).toMatchObject({ billed: 12000, waived: 1000, paid: 5000, owed: 6000 });
    expect(t.percentPaid).toBeCloseTo((5000 / 11000) * 100);
  });
  it('caps the share at 100 and is 0 when nothing is billed', () => {
    expect(feeTotals([line({ charged: 1000, paid: 1500, balance: -500 })]).percentPaid).toBe(100);
    expect(feeTotals([]).percentPaid).toBe(0);
    expect(feeTotals([line({ charged: 500, waived: 500 })]).percentPaid).toBe(0);
  });
});

describe('scorePercent / formatScore', () => {
  it('scales a mark to its own maximum and clamps', () => {
    expect(scorePercent({ score: 39, maxScore: 50 })).toBe(78);
    expect(scorePercent({ score: 73, maxScore: 100 })).toBe(73);
    expect(scorePercent({ score: 120, maxScore: 100 })).toBe(100);
    expect(scorePercent({ score: 10, maxScore: 0 })).toBe(0);
  });
  it('shows the maximum only when it is not 100', () => {
    expect(formatScore({ score: 73, maxScore: 100 })).toBe('73');
    expect(formatScore({ score: 39, maxScore: 50 })).toBe('39/50');
  });
});

describe('groupResults', () => {
  const row = (examId: string, subjectName: string, score: number, maxScore = 100) => ({
    examId, examName: `Exam ${examId}`, term: 'Term 1', academicYear: 2026, subjectName, score, maxScore,
  });
  it('groups by exam, preserves order, computes average and strongest', () => {
    const g = groupResults([row('2', 'Maths', 80), row('2', 'English', 60), row('1', 'Maths', 40)]);
    expect(g.map((x) => x.examId)).toEqual(['2', '1']);
    expect(g[0].average).toBe(70);
    expect(g[0].strongest?.subjectName).toBe('Maths');
  });
  it('compares subjects by percentage when maximums differ', () => {
    const g = groupResults([row('1', 'Maths', 45, 50), row('1', 'English', 80)]);
    expect(g[0].average).toBe(85);
    expect(g[0].strongest?.subjectName).toBe('Maths');
  });
  it('returns nothing for no results', () => {
    expect(groupResults([])).toEqual([]);
  });
});

describe('helpers', () => {
  it('reads attendance counts case-insensitively', () => {
    expect(attendanceDays([{ status: 'Present', days: 41 }], 'present')).toBe(41);
    expect(attendanceDays([], 'present')).toBe(0);
  });
  it('validates Kenyan phone numbers', () => {
    for (const ok of ['0712 345 678', '0112345678', '+254712345678', '0712-345-678']) expect(isKenyanPhone(ok)).toBe(true);
    for (const bad of ['', '071234567', '0812345678', '+255712345678', 'abc']) expect(isKenyanPhone(bad)).toBe(false);
  });
  it('formats a stored number the way parents type it', () => {
    expect(formatSavedPhone('254712345678')).toBe('0712 345 678');
    expect(formatSavedPhone('+254112345678')).toBe('0112 345 678');
    expect(formatSavedPhone('0712345678')).toBe('0712 345 678');
    expect(formatSavedPhone('12345')).toBe('12345');
    expect(isKenyanPhone(formatSavedPhone('254712345678'))).toBe(true);
  });
  it('derives names', () => {
    expect(firstName('  Amina  Otieno ')).toBe('Amina');
    expect(initials('amina otieno')).toBe('AO');
    expect(initials('')).toBe('');
  });
});

const lesson = (o: Partial<MyChildLesson> = {}): MyChildLesson => ({
  entryId: 'e1', dayOfWeek: 4, periodNumber: 1, startTime: '08:00', endTime: '08:40',
  slotLabel: null, subjectName: 'Maths', teacherName: 'Mr Kamau', room: null, ...o,
});

describe('timetable helpers', () => {
  it('defaults to today on weekdays and Monday on weekends', () => {
    // 2026-11-02 is a Monday
    for (let i = 0; i < 5; i++) expect(defaultTimetableDay(new Date(2026, 10, 2 + i, 12))).toBe(1 + i);
    expect(defaultTimetableDay(new Date(2026, 10, 7, 12))).toBe(1); // Saturday
    expect(defaultTimetableDay(new Date(2026, 10, 8, 12))).toBe(1); // Sunday
  });

  it('always offers Monday to Friday and adds weekend days only when they have lessons', () => {
    expect(timetableTabDays([])).toEqual([1, 2, 3, 4, 5]);
    expect(timetableTabDays([lesson({ dayOfWeek: 6 })])).toEqual([1, 2, 3, 4, 5, 6]);
    expect(timetableTabDays([lesson({ dayOfWeek: 0 }), lesson({ dayOfWeek: 6 })])).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(timetableTabDays([lesson({ dayOfWeek: 9 })])).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps only the chosen day and orders by period then start time', () => {
    const list = [
      lesson({ entryId: 'c', periodNumber: 3, startTime: '10:00', endTime: '10:40' }),
      lesson({ entryId: 'a', periodNumber: 1 }),
      lesson({ entryId: 'other', dayOfWeek: 2 }),
      lesson({ entryId: 'b', periodNumber: 2, startTime: '08:40', endTime: '09:20' }),
    ];
    expect(lessonsForDay(list, 4).map((l) => l.entryId)).toEqual(['a', 'b', 'c']);
    expect(lessonsForDay(list, 5)).toEqual([]);
  });

  it('does not mutate the input when sorting', () => {
    const list = [lesson({ entryId: 'b', periodNumber: 2 }), lesson({ entryId: 'a', periodNumber: 1 })];
    lessonsForDay(list, 4);
    expect(list.map((l) => l.entryId)).toEqual(['b', 'a']);
  });

  it('flags a lesson as in progress only on its day and within start-inclusive, end-exclusive', () => {
    const l = lesson(); // Thursday 08:00-08:40
    const at = (h: number, m: number, day = 5) => new Date(2026, 10, day, h, m); // 5 Nov 2026 is a Thursday
    expect(isLessonNow(l, at(7, 59))).toBe(false);
    expect(isLessonNow(l, at(8, 0))).toBe(true);
    expect(isLessonNow(l, at(8, 39))).toBe(true);
    expect(isLessonNow(l, at(8, 40))).toBe(false);
    expect(isLessonNow(l, at(8, 10, 6))).toBe(false); // Friday
  });

  it('treats unparseable times as not in progress', () => {
    expect(isLessonNow(lesson({ startTime: '', endTime: '' }), new Date(2026, 10, 5, 8, 10))).toBe(false);
  });

  it('titles a lesson by subject, then slot label, then free period', () => {
    expect(lessonTitle(lesson())).toBe('Maths');
    expect(lessonTitle(lesson({ subjectName: null, slotLabel: 'Break' }))).toBe('Break');
    expect(lessonTitle(lesson({ subjectName: null, slotLabel: null }))).toBe('Free period');
  });
});
