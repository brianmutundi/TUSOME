import type { AnalyticsSelection, ExamOption, StreamOption } from './types';

export const EMPTY_SELECTION: AnalyticsSelection = {
  academicYear: '',
  examId: '',
  classId: '',
  streamId: '',
};

export function uniqueAcademicYears(exams: ExamOption[]): string[] {
  return Array.from(
    new Set(
      exams
        .map((exam) => exam.academic_year)
        .filter((year): year is number => typeof year === 'number' && Number.isFinite(year))
    )
  )
    .sort((a, b) => b - a)
    .map(String);
}

export function examsForYear(exams: ExamOption[], academicYear: string): ExamOption[] {
  if (!academicYear) return exams;
  return exams.filter((exam) => String(exam.academic_year ?? '') === academicYear);
}

export function streamsForClass(streams: StreamOption[], classId: string): StreamOption[] {
  if (!classId) return streams;
  return streams.filter((stream) => stream.class_id === classId);
}

/**
 * Choose a coherent initial selection. The newest academic year and its newest
 * published exam are selected, with all classes/streams shown.
 */
export function defaultSelection(exams: ExamOption[]): AnalyticsSelection {
  const years = uniqueAcademicYears(exams);
  const academicYear = years[0] ?? '';
  const exam = examsForYear(exams, academicYear)[0] ?? exams[0];
  return {
    ...EMPTY_SELECTION,
    academicYear,
    examId: exam?.id ?? '',
  };
}

/**
 * Keep a selection valid after filters reload or the user changes an upstream
 * filter. Prevents a stale exam/class id from returning an empty dashboard.
 */
export function reconcileSelection(
  selection: AnalyticsSelection,
  exams: ExamOption[],
  streams: StreamOption[]
): AnalyticsSelection {
  const years = uniqueAcademicYears(exams);
  const academicYear = years.includes(selection.academicYear)
    ? selection.academicYear
    : (years[0] ?? '');

  const yearExams = examsForYear(exams, academicYear);
  const examId = yearExams.some((exam) => exam.id === selection.examId)
    ? selection.examId
    : (yearExams[0]?.id ?? '');

  const availableStreams = streamsForClass(streams, selection.classId);
  const streamId = availableStreams.some((stream) => stream.id === selection.streamId)
    ? selection.streamId
    : '';

  return { ...selection, academicYear, examId, streamId };
}

export function hasActiveFilters(selection: AnalyticsSelection): boolean {
  return Boolean(selection.classId || selection.streamId);
}

export function activeFilterCount(selection: AnalyticsSelection): number {
  return (selection.classId ? 1 : 0) + (selection.streamId ? 1 : 0);
}
