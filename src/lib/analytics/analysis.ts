import type { StudentExamHistoryRow } from './types';

/**
 * Pure helpers for the `get_student_exam_history` and `get_most_improved` RPCs.
 *
 * The RPCs already order rows and compute positions. These helpers derive
 * deltas and presentation values from already-normalized data.
 */

export interface DeltaSummary {
  current_mean: number;
  previous_mean: number;
  delta: number;
  previous_exam_name: string;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Pick the two most recent exams and compare their means.
 * Ordering mirrors the SQL function: academic year first, then exam id.
 */
export function computeStudentDelta(
  history: ReadonlyArray<
    Pick<StudentExamHistoryRow, 'exam_id' | 'exam_name' | 'mean_score' | 'academic_year'>
  >
): DeltaSummary | null {
  if (history.length < 2) return null;

  const sorted = [...history].sort(
    (a, b) =>
      (b.academic_year ?? 0) - (a.academic_year ?? 0) || b.exam_id.localeCompare(a.exam_id)
  );

  const current = sorted[0];
  const previous = sorted[1];
  if (!current || !previous) return null;

  return {
    current_mean: round2(current.mean_score),
    previous_mean: round2(previous.mean_score),
    delta: round2(current.mean_score - previous.mean_score),
    previous_exam_name: previous.exam_name,
  };
}

/** Mean of the mean_score values across a student's published exam history. */
export function meanScoreFromHistory(
  history: ReadonlyArray<Pick<StudentExamHistoryRow, 'mean_score'>>
): number {
  if (history.length === 0) return 0;
  const total = history.reduce((sum, entry) => sum + entry.mean_score, 0);
  return round2(total / history.length);
}

/** Hardcoded fallback grade for a score, used only where no configuration grade exists. */
export function gradeFromScore(score: number): string {
  if (score >= 80) return 'A1';
  if (score >= 70) return 'A';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

export interface StudentWithHistory {
  student_id: string;
  admission_no: string;
  student_name: string;
  stream_name: string | null;
  history: ReadonlyArray<
    Pick<StudentExamHistoryRow, 'exam_id' | 'exam_name' | 'mean_score' | 'academic_year'>
  >;
}

export interface MostImprovedCandidate extends DeltaSummary {
  student_id: string;
  admission_no: string;
  student_name: string;
  stream_name: string | null;
}

/** The single most improved student across a set of student histories. */
export function pickMostImproved(
  students: ReadonlyArray<StudentWithHistory>
): MostImprovedCandidate | null {
  let best: MostImprovedCandidate | null = null;

  for (const student of students) {
    const delta = computeStudentDelta(student.history);
    if (!delta) continue;
    if (!best || delta.delta > best.delta) {
      best = {
        student_id: student.student_id,
        admission_no: student.admission_no,
        student_name: student.student_name,
        stream_name: student.stream_name,
        ...delta,
      };
    }
  }

  return best;
}

/** Rank students by improvement, best first. Students without a comparison are excluded. */
export function rankMostImproved(
  students: ReadonlyArray<StudentWithHistory>
): MostImprovedCandidate[] {
  return students
    .map((student) => {
      const delta = computeStudentDelta(student.history);
      if (!delta) return null;
      return {
        student_id: student.student_id,
        admission_no: student.admission_no,
        student_name: student.student_name,
        stream_name: student.stream_name,
        ...delta,
      } satisfies MostImprovedCandidate;
    })
    .filter((entry): entry is MostImprovedCandidate => entry !== null)
    .sort((a, b) => b.delta - a.delta);
}
