import type { MarkSheetRow } from './types';

/**
 * Pure helpers for the `get_mark_sheet` RPC.
 *
 * These functions receive already-normalized MarkSheetRow arrays and derive
 * class summaries, subject aggregates, and analysis reports without touching
 * the database. They mirror the aggregation rules used by the SQL analytics
 * functions: the pass mark is `score >= 40` and broad grade counts come from
 * the row's grading configuration.
 */

const PASS_MARK = 40;

export interface ClassPerformanceSummary {
  class_name: string;
  stream_name: string | null;
  total_students: number;
  total_marks: number;
  mean_score: number;
  pass_count: number;
  pass_rate: number;
  grade_distribution: GradeBucket[];
}

export interface GradeBucket {
  grade_code: string;
  grade_name: string;
  count: number;
  percentage: number;
}

export interface SubjectAggregate {
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  total_students: number;
  mean_score: number;
  highest_score: number;
  lowest_score: number;
  pass_count: number;
  pass_rate: number;
  ee_count: number;
  me_count: number;
  ae_count: number;
  be_count: number;
}

export interface AnalysisReport {
  class_average: number;
  subject_averages: SubjectAggregate[];
  top_performers: Performer[];
  bottom_performers: Performer[];
  grade_distribution: GradeBucket[];
}

export interface Performer {
  student_name: string;
  admission_no: string;
  score: number;
  grade: string | null;
}

function filterRows(
  rows: MarkSheetRow[],
  className?: string | null,
  streamName?: string | null
): MarkSheetRow[] {
  return rows.filter(
    (row) =>
      (className === undefined || className === null || row.class_name === className) &&
      (streamName === undefined || streamName === null || row.stream_name === streamName)
  );
}

function gradeBuckets(rows: MarkSheetRow[]): GradeBucket[] {
  const buckets = new Map<string, { grade_name: string; count: number }>();
  for (const row of rows) {
    const code = row.grade_code ?? 'UN';
    const name = row.grade_name ?? row.grade_code ?? 'Ungraded';
    const existing = buckets.get(code);
    if (existing) existing.count += 1;
    else buckets.set(code, { grade_name: name, count: 1 });
  }
  const total = rows.length || 1;
  return Array.from(buckets.entries()).map(([grade_code, { grade_name, count }]) => ({
    grade_code,
    grade_name,
    count,
    percentage: (count / total) * 100,
  }));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Aggregate marks for a class (and optional stream). */
export function getClassPerformance(
  rows: MarkSheetRow[],
  className: string,
  streamName?: string | null
): ClassPerformanceSummary {
  const classRows = filterRows(rows, className, streamName);
  const scores = classRows.map((row) => row.score);
  const passed = classRows.filter((row) => row.score >= PASS_MARK).length;

  return {
    class_name: className,
    stream_name: streamName ?? null,
    total_students: classRows.length,
    total_marks: scores.reduce((sum, score) => sum + score, 0),
    mean_score: round2(mean(scores)),
    pass_count: passed,
    pass_rate: round2(classRows.length > 0 ? (passed / classRows.length) * 100 : 0),
    grade_distribution: gradeBuckets(classRows),
  };
}

/** Per-subject aggregates. Omit className to aggregate every row. */
export function getSubjectPerformance(
  rows: MarkSheetRow[],
  className?: string | null,
  streamName?: string | null
): SubjectAggregate[] {
  const scoped = filterRows(rows, className, streamName);
  const groups = new Map<string, MarkSheetRow[]>();
  for (const row of scoped) {
    const existing = groups.get(row.subject_id);
    if (existing) existing.push(row);
    else groups.set(row.subject_id, [row]);
  }

  return Array.from(groups.entries()).map(([subjectId, subjectRows]) => {
    const scores = subjectRows.map((row) => row.score);
    const passed = subjectRows.filter((row) => row.score >= PASS_MARK).length;
    const codes = subjectRows.map((row) => (row.grade_code ?? '').toUpperCase());
    const first = subjectRows[0];

    return {
      subject_id: subjectId,
      subject_name: first.subject_name,
      subject_code: first.subject_code,
      total_students: subjectRows.length,
      mean_score: round2(mean(scores)),
      highest_score: Math.max(...scores),
      lowest_score: Math.min(...scores),
      pass_count: passed,
      pass_rate: round2(subjectRows.length > 0 ? (passed / subjectRows.length) * 100 : 0),
      ee_count: codes.filter((code) => code === 'A1' || code === 'EE').length,
      me_count: codes.filter((code) => code === 'A' || code === 'ME').length,
      ae_count: codes.filter((code) => code === 'B' || code === 'AE').length,
      be_count: codes.filter((code) => code === 'C' || code === 'BE').length,
    };
  });
}

/** Overall class grade summary (one row per class/stream). */
export function getClassGradeSummary(
  rows: MarkSheetRow[],
  className: string,
  streamName?: string | null
): ClassPerformanceSummary {
  return getClassPerformance(rows, className, streamName);
}

/** Build a full analysis report from mark-sheet rows. */
export function buildAnalysisReport(rows: MarkSheetRow[]): AnalysisReport {
  if (rows.length === 0) {
    return {
      class_average: 0,
      subject_averages: [],
      top_performers: [],
      bottom_performers: [],
      grade_distribution: [],
    };
  }

  const toPerformer = (row: MarkSheetRow): Performer => ({
    student_name: row.student_name,
    admission_no: row.admission_no,
    score: row.score,
    grade: row.grade_name,
  });

  const sorted = [...rows].sort((a, b) => b.score - a.score);

  return {
    class_average: round2(mean(rows.map((row) => row.score))),
    subject_averages: getSubjectPerformance(rows),
    top_performers: sorted.slice(0, 5).map(toPerformer),
    bottom_performers: [...sorted].reverse().slice(0, 5).map(toPerformer),
    grade_distribution: gradeBuckets(rows),
  };
}
