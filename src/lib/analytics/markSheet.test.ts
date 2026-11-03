import { describe, expect, it } from 'vitest';
import {
  buildAnalysisReport,
  getClassGradeSummary,
  getClassPerformance,
  getSubjectPerformance,
} from './markSheet';
import type { MarkSheetRow } from './types';

const rows: MarkSheetRow[] = [
  {
    student_id: 's1',
    admission_no: 'A-001',
    student_name: 'Alice A',
    class_name: 'Class A1',
    stream_name: 'Blue',
    subject_id: 'math',
    subject_name: 'Mathematics',
    subject_code: 'MAT',
    score: 85,
    grade_code: 'A1',
    grade_name: 'A1',
    points: 8,
  },
  {
    student_id: 's2',
    admission_no: 'A-002',
    student_name: 'Bob B',
    class_name: 'Class A1',
    stream_name: 'Blue',
    subject_id: 'math',
    subject_name: 'Mathematics',
    subject_code: 'MAT',
    score: 42,
    grade_code: 'D',
    grade_name: 'D',
    points: 2,
  },
  {
    student_id: 's3',
    admission_no: 'A-003',
    student_name: 'Charlie C',
    class_name: 'Class A1',
    stream_name: 'Blue',
    subject_id: 'eng',
    subject_name: 'English',
    subject_code: 'ENG',
    score: 72,
    grade_code: 'ME',
    grade_name: 'Meeting Expectations',
    points: 3,
  },
  {
    student_id: 's4',
    admission_no: 'A-004',
    student_name: 'Diana D',
    class_name: 'Class A1',
    stream_name: 'Red',
    subject_id: 'math',
    subject_name: 'Mathematics',
    subject_code: 'MAT',
    score: 55,
    grade_code: 'C',
    grade_name: 'C',
    points: 1,
  },
];

describe('getClassPerformance', () => {
  it('aggregates a class and stream', () => {
    const summary = getClassPerformance(rows, 'Class A1', 'Blue');
    expect(summary.class_name).toBe('Class A1');
    expect(summary.stream_name).toBe('Blue');
    expect(summary.total_students).toBe(3);
    expect(summary.total_marks).toBe(199);
    expect(summary.mean_score).toBe(66.33);
    expect(summary.pass_count).toBe(3); // every score is >= 40
    expect(summary.pass_rate).toBe(100);
    expect(summary.grade_distribution).toHaveLength(3);
  });

  it('returns zeros for a class with no rows', () => {
    const summary = getClassPerformance(rows, 'Class A2');
    expect(summary.total_students).toBe(0);
    expect(summary.mean_score).toBe(0);
    expect(summary.pass_count).toBe(0);
    expect(summary.pass_rate).toBe(0);
    expect(summary.grade_distribution).toEqual([]);
  });
});

describe('getSubjectPerformance', () => {
  it('aggregates per subject within a class and stream', () => {
    const subjects = getSubjectPerformance(rows, 'Class A1', 'Blue');
    expect(subjects).toHaveLength(2);

    const math = subjects.find((s) => s.subject_id === 'math');
    expect(math).toMatchObject({
      total_students: 2,
      mean_score: 63.5,
      highest_score: 85,
      lowest_score: 42,
      pass_count: 2,
      pass_rate: 100,
      ee_count: 1,
      me_count: 0,
    });

    const english = subjects.find((s) => s.subject_id === 'eng');
    expect(english).toMatchObject({ total_students: 1, mean_score: 72, me_count: 1 });
  });

  it('aggregates every row when no class is given', () => {
    const subjects = getSubjectPerformance(rows);
    const math = subjects.find((s) => s.subject_id === 'math');
    expect(math?.total_students).toBe(3); // includes the Red stream row
    expect(math?.mean_score).toBe(60.67);
  });

  it('returns an empty array when nothing matches', () => {
    expect(getSubjectPerformance(rows, 'Class A2')).toEqual([]);
  });
});

describe('getClassGradeSummary', () => {
  it('matches the class performance summary', () => {
    expect(getClassGradeSummary(rows, 'Class A1', 'Blue')).toEqual(
      getClassPerformance(rows, 'Class A1', 'Blue')
    );
  });
});

describe('buildAnalysisReport', () => {
  it('builds class averages, performers and distribution', () => {
    const report = buildAnalysisReport(rows);
    expect(report.class_average).toBe(63.5);
    expect(report.subject_averages).toHaveLength(2);
    expect(report.top_performers[0]).toMatchObject({ student_name: 'Alice A', score: 85 });
    expect(report.bottom_performers[0]).toMatchObject({ student_name: 'Bob B', score: 42 });
    expect(report.grade_distribution).toHaveLength(4);
  });

  it('returns an empty report for no rows', () => {
    expect(buildAnalysisReport([])).toEqual({
      class_average: 0,
      subject_averages: [],
      top_performers: [],
      bottom_performers: [],
      grade_distribution: [],
    });
  });
});
