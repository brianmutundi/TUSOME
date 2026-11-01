import { describe, expect, it } from 'vitest';
import {
  formatExamLabel,
  formatNumber,
  formatOrdinal,
  formatPercent,
  formatReportExam,
  formatScore,
  gradeBadgeClass,
  meanOf,
  percentageOf,
} from './format';

describe('number formatting', () => {
  it('formats scores and percentages with a dash for missing values', () => {
    expect(formatScore(58.456)).toBe('58.5');
    expect(formatScore(null)).toBe('—');
    expect(formatPercent(58.5)).toBe('58.50%');
    expect(formatPercent(Number.NaN)).toBe('—');
    expect(formatNumber(1234.5)).toContain('1,234.5');
    expect(formatNumber(undefined)).toBe('—');
  });
});

describe('formatOrdinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [23, '23rd'],
    [101, '101st'],
    [111, '111th'],
  ])('%i -> %s', (value, expected) => {
    expect(formatOrdinal(value)).toBe(expected);
  });

  it('handles missing and negative ordinal values', () => {
    expect(formatOrdinal(null)).toBe('—');
    expect(formatOrdinal(-1)).toBe('-1st');
  });
});

describe('exam labels', () => {
  it('joins the exam name, term and year', () => {
    expect(
      formatExamLabel({
        id: 'x',
        name: 'End Term',
        term: 'Term 1',
        academic_year: 2026,
        assessment_component: 'end_term',
        status: 'published',
        published_at: null,
      })
    ).toBe('End Term · Term 1 · 2026');
  });

  it('omits blank parts of a report exam label', () => {
    expect(
      formatReportExam({ name: 'Exam', term: '', year: 2026, assessment_component: '' })
    ).toBe('Exam · 2026');
  });
});

describe('gradeBadgeClass', () => {
  it('maps broad grade prefixes to colours', () => {
    expect(gradeBadgeClass('EE')).toContain('emerald');
    expect(gradeBadgeClass('EE1')).toContain('emerald');
    expect(gradeBadgeClass('ME')).toContain('blue');
    expect(gradeBadgeClass('AE')).toContain('amber');
    expect(gradeBadgeClass('BE')).toContain('rose');
    expect(gradeBadgeClass(null)).toContain('gray');
  });
});

describe('maths helpers', () => {
  it('avoids divide-by-zero and ignores non-finite values', () => {
    expect(percentageOf(5, 10)).toBe(50);
    expect(percentageOf(5, 0)).toBe(0);
    expect(meanOf([10, 20, 30])).toBe(20);
    expect(meanOf([])).toBe(0);
    expect(meanOf([10, Number.NaN, 20])).toBe(15);
  });
});
