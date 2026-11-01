import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  defaultSelection,
  examsForYear,
  hasActiveFilters,
  reconcileSelection,
  streamsForClass,
  uniqueAcademicYears,
} from './filters';
import type { ExamOption, StreamOption } from './types';

function exam(id: string, year: number | null, publishedAt: string | null = null): ExamOption {
  return {
    id,
    name: `Exam ${id}`,
    term: 'Term 1',
    academic_year: year,
    assessment_component: null,
    status: 'published',
    published_at: publishedAt,
  };
}

const exams = [
  exam('e2026a', 2026, '2026-06-01T00:00:00Z'),
  exam('e2026b', 2026, '2026-09-01T00:00:00Z'),
  exam('e2025', 2025),
  exam('eunknown', null),
];

const streams: StreamOption[] = [
  { id: 's-blue', class_id: 'c1', name: 'Blue' },
  { id: 's-red', class_id: 'c1', name: 'Red' },
  { id: 's-north', class_id: 'c2', name: 'North' },
];

describe('uniqueAcademicYears', () => {
  it('returns distinct years, newest first, ignoring null', () => {
    expect(uniqueAcademicYears(exams)).toEqual(['2026', '2025']);
  });

  it('handles no exams', () => {
    expect(uniqueAcademicYears([])).toEqual([]);
  });
});

describe('examsForYear', () => {
  it('filters by year and preserves source order', () => {
    expect(examsForYear(exams, '2026').map((item) => item.id)).toEqual(['e2026a', 'e2026b']);
  });

  it('returns all exams when no year is selected', () => {
    expect(examsForYear(exams, '')).toHaveLength(4);
  });
});

describe('streamsForClass', () => {
  it('only returns streams for the selected class', () => {
    expect(streamsForClass(streams, 'c1').map((item) => item.id)).toEqual(['s-blue', 's-red']);
  });

  it('returns all streams when no class is selected', () => {
    expect(streamsForClass(streams, '')).toHaveLength(3);
  });
});

describe('defaultSelection', () => {
  it('selects the newest year and its first published exam', () => {
    expect(defaultSelection(exams)).toEqual({
      academicYear: '2026',
      examId: 'e2026a',
      classId: '',
      streamId: '',
    });
  });

  it('falls back to the first exam when years are missing', () => {
    expect(defaultSelection([exam('x', null)]).examId).toBe('x');
  });

  it('returns an empty selection when there are no exams', () => {
    expect(defaultSelection([]).examId).toBe('');
  });
});

describe('reconcileSelection', () => {
  it('keeps a valid selection', () => {
    const selection = { academicYear: '2026', examId: 'e2026b', classId: 'c1', streamId: 's-red' };
    expect(reconcileSelection(selection, exams, streams)).toEqual(selection);
  });

  it('moves to the newest year and exam when the selected year disappears', () => {
    const selection = { academicYear: '2024', examId: 'gone', classId: '', streamId: '' };
    expect(reconcileSelection(selection, exams, streams)).toMatchObject({
      academicYear: '2026',
      examId: 'e2026a',
    });
  });

  it('clears a stream that does not belong to the selected class', () => {
    const selection = { academicYear: '2026', examId: 'e2026b', classId: 'c2', streamId: 's-blue' };
    expect(reconcileSelection(selection, exams, streams).streamId).toBe('');
  });

  it('keeps a valid stream when the class filter is cleared', () => {
    const selection = { academicYear: '2026', examId: 'e2026b', classId: '', streamId: 's-blue' };
    // With no class filter every stream remains valid; the class select clears
    // it explicitly in the UI when the user changes class.
    expect(reconcileSelection(selection, exams, streams).streamId).toBe('s-blue');
  });
});

describe('filter helpers', () => {
  it('reports active class/stream filters', () => {
    expect(hasActiveFilters({ academicYear: '2026', examId: 'x', classId: '', streamId: '' })).toBe(false);
    expect(hasActiveFilters({ academicYear: '2026', examId: 'x', classId: 'c1', streamId: '' })).toBe(true);
    expect(activeFilterCount({ academicYear: '2026', examId: 'x', classId: 'c1', streamId: 's1' })).toBe(2);
  });
});
