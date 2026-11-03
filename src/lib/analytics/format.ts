import type { ExamOption } from './types';

const NUMERIC = new Intl.NumberFormat('en-KE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (digits === 2) return NUMERIC.format(value);
  return value.toFixed(digits);
}

export function formatScore(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatOrdinal(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const n = Math.trunc(value);
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (Math.abs(n) % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatExamLabel(exam: ExamOption): string {
  const parts = [exam.name];
  const term = exam.term?.trim();
  if (term) parts.push(term);
  if (exam.academic_year) parts.push(String(exam.academic_year));
  return parts.join(' · ');
}

export function formatReportExam(
  exam: { name: string; term: string; year: number; assessment_component: string } | null | undefined
): string {
  if (!exam) return '';
  return [exam.name, exam.term, exam.year ? String(exam.year) : '', exam.assessment_component]
    .filter(Boolean)
    .join(' · ');
}

/** Colour classes for grade badges, keyed by broad code then grade code. */
export function gradeBadgeClass(code: string | null | undefined): string {
  const key = (code ?? '').toUpperCase();
  if (key.startsWith('EE')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (key.startsWith('ME')) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (key.startsWith('AE')) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (key.startsWith('BE')) return 'bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

export function percentageOf(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return (part / total) * 100;
}

export function meanOf(values: number[]): number {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return 0;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}
