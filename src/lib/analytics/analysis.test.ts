import { describe, expect, it } from 'vitest';
import {
  computeStudentDelta,
  gradeFromScore,
  meanScoreFromHistory,
  pickMostImproved,
  rankMostImproved,
} from './analysis';
import type { StudentExamHistoryRow } from './types';

function historyRow(
  overrides: Partial<StudentExamHistoryRow> & Pick<StudentExamHistoryRow, 'exam_id' | 'exam_name' | 'mean_score'>
): StudentExamHistoryRow {
  return {
    term: 'Term 1',
    academic_year: 2025,
    assessment_component: 'end_term',
    total_score: 0,
    subjects_count: 5,
    overall_grade: 'C',
    overall_points: 1,
    position: 1,
    total_in_exam: 10,
    ...overrides,
  };
}

const twoExams = [
  historyRow({ exam_id: 'e1', exam_name: 'Mid Term', mean_score: 55, academic_year: 2025 }),
  historyRow({ exam_id: 'e2', exam_name: 'End Term', mean_score: 72, academic_year: 2026 }),
];

describe('computeStudentDelta', () => {
  it('compares the two most recent exams by academic year', () => {
    expect(computeStudentDelta(twoExams)).toEqual({
      current_mean: 72,
      previous_mean: 55,
      delta: 17,
      previous_exam_name: 'Mid Term',
    });
  });

  it('orders by exam id when academic years tie', () => {
    const sameYear = [
      historyRow({ exam_id: 'e1', exam_name: 'First', mean_score: 50, academic_year: 2025 }),
      historyRow({ exam_id: 'e2', exam_name: 'Second', mean_score: 60, academic_year: 2025 }),
    ];
    expect(computeStudentDelta(sameYear)?.delta).toBe(10); // e2 is "current", e1 "previous"
    expect(computeStudentDelta(sameYear)?.previous_exam_name).toBe('First');
  });

  it('returns null with fewer than two exams', () => {
    expect(computeStudentDelta(twoExams.slice(0, 1))).toBeNull();
    expect(computeStudentDelta([])).toBeNull();
  });

  it('does not mutate the input array', () => {
    const input = [...twoExams];
    computeStudentDelta(input);
    expect(input.map((row) => row.exam_id)).toEqual(['e1', 'e2']);
  });
});

describe('meanScoreFromHistory', () => {
  it('averages mean scores', () => {
    expect(meanScoreFromHistory(twoExams)).toBe(63.5);
  });

  it('returns zero for empty history', () => {
    expect(meanScoreFromHistory([])).toBe(0);
  });
});

describe('gradeFromScore', () => {
  it('maps scores to fallback grades', () => {
    expect(gradeFromScore(95)).toBe('A1');
    expect(gradeFromScore(75)).toBe('A');
    expect(gradeFromScore(65)).toBe('B');
    expect(gradeFromScore(55)).toBe('C');
    expect(gradeFromScore(45)).toBe('D');
    expect(gradeFromScore(35)).toBe('E');
  });
});

describe('pickMostImproved / rankMostImproved', () => {
  const students = [
    {
      student_id: 's1',
      admission_no: 'A-001',
      student_name: 'Alice',
      stream_name: 'Blue',
      history: twoExams,
    },
    {
      student_id: 's2',
      admission_no: 'A-002',
      student_name: 'Bob',
      stream_name: 'Red',
      history: [
        historyRow({ exam_id: 'e1', exam_name: 'Mid Term', mean_score: 60, academic_year: 2025 }),
        historyRow({ exam_id: 'e2', exam_name: 'End Term', mean_score: 65, academic_year: 2026 }),
      ],
    },
    {
      student_id: 's3',
      admission_no: 'A-003',
      student_name: 'Cara',
      stream_name: null,
      history: [historyRow({ exam_id: 'e1', exam_name: 'Only', mean_score: 90 })],
    },
  ];

  it('picks the largest positive delta', () => {
    const best = pickMostImproved(students);
    expect(best?.student_name).toBe('Alice');
    expect(best?.delta).toBe(17);
  });

  it('ranks every comparable student, best first', () => {
    const ranked = rankMostImproved(students);
    expect(ranked.map((entry) => entry.student_name)).toEqual(['Alice', 'Bob']);
  });

  it('returns null / empty when nobody has a comparison', () => {
    expect(pickMostImproved([students[2]])).toBeNull();
    expect(rankMostImproved([students[2]])).toEqual([]);
  });
});
