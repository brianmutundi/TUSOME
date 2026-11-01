import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClassPerformanceTable } from './ClassPerformanceTable';
import type { ClassPerformanceStudent } from '@/lib/analytics/types';

const { downloadCsvMock } = vi.hoisted(() => ({ downloadCsvMock: vi.fn() }));

vi.mock('@/lib/analytics/csv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics/csv')>();
  return { ...actual, downloadCsv: downloadCsvMock };
});

function student(overrides: Partial<ClassPerformanceStudent>): ClassPerformanceStudent {
  return {
    student_id: 'a5000000-0000-0000-0000-000000000001',
    admission_no: 'A-001',
    student_name: 'Alice A',
    stream_name: 'Blue',
    total_score: 116,
    mean_score: 58,
    mean_percentage: 58,
    overall_grade: 'AE',
    overall_points: 2,
    class_position: 2,
    subjects_count: 2,
    passed_count: 1,
    ...overrides,
  };
}

const students = [
  student({}),
  student({
    student_id: 'a5000000-0000-0000-0000-000000000002',
    admission_no: 'A-002',
    student_name: 'Bob B',
    stream_name: null,
    total_score: 150,
    mean_score: 75,
    mean_percentage: 75,
    overall_grade: 'ME',
    overall_points: 3,
    class_position: 1,
    passed_count: 2,
  }),
];

function dataRowNames(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[2].textContent ?? '');
}

describe('ClassPerformanceTable', () => {
  it('renders students in position order by default', () => {
    render(<ClassPerformanceTable students={students} examId="exam-1" examLabel="Exam" />);
    expect(dataRowNames()).toEqual(['Bob B', 'Alice A']);
  });

  it('sorts by student name when the header is activated', async () => {
    const user = userEvent.setup();
    render(<ClassPerformanceTable students={students} examId="exam-1" />);

    await user.click(screen.getByRole('button', { name: /student/i }));
    expect(dataRowNames()).toEqual(['Alice A', 'Bob B']);

    await user.click(screen.getByRole('button', { name: /student/i }));
    expect(dataRowNames()).toEqual(['Bob B', 'Alice A']);
  });

  it('filters by name, admission number or stream', async () => {
    const user = userEvent.setup();
    render(<ClassPerformanceTable students={students} examId="exam-1" />);

    await user.type(screen.getByLabelText('Search students'), 'A-002');
    expect(dataRowNames()).toEqual(['Bob B']);

    await user.clear(screen.getByLabelText('Search students'));
    await user.type(screen.getByLabelText('Search students'), 'blue');
    expect(dataRowNames()).toEqual(['Alice A']);
  });

  it('shows a specific empty state when the search has no matches', async () => {
    const user = userEvent.setup();
    render(<ClassPerformanceTable students={students} examId="exam-1" />);
    await user.type(screen.getByLabelText('Search students'), 'zzz');
    expect(screen.getByText('No matching students')).toBeInTheDocument();
  });

  it('shows the no-marks empty state when there are no students', () => {
    render(<ClassPerformanceTable students={[]} examId="exam-1" />);
    expect(screen.getByText('No students with marks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  });

  it('links to the report with the exam id', () => {
    render(<ClassPerformanceTable students={students} examId="exam-1" />);
    const links = screen.getAllByRole('link', { name: 'View report' });
    expect(links[0]).toHaveAttribute('href', '/analytics/report/a5000000-0000-0000-0000-000000000002?exam=exam-1');
  });

  it('exports only the filtered rows', async () => {
    const user = userEvent.setup();
    render(<ClassPerformanceTable students={students} examId="exam-1" examLabel="Exam · Term 1" />);

    await user.type(screen.getByLabelText('Search students'), 'Bob');
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(downloadCsvMock).toHaveBeenCalledTimes(1);
    const [filename, csv] = downloadCsvMock.mock.calls[0] as [string, string];
    expect(filename).toBe('class-performance-Exam · Term 1.csv');
    expect(csv).toContain('Admission number');
    expect(csv).toContain('Bob B');
    expect(csv).not.toContain('Alice A');
  });
});
