import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GradeDistributionChart } from './GradeDistributionChart';

const grades = [
  {
    grade_code: 'EE',
    grade_name: 'Exceeding Expectations',
    broad_grade: 'EE',
    count: 3,
    percentage: 30,
    color: '#16a34a',
  },
  {
    grade_code: 'ME',
    grade_name: 'Meeting Expectations',
    broad_grade: 'ME',
    count: 7,
    percentage: 70,
    color: '#2563eb',
  },
];

describe('GradeDistributionChart', () => {
  it('renders each grade with count, percentage and an accessible label', () => {
    render(<GradeDistributionChart grades={grades} />);
    expect(
      screen.getByRole('img', { name: 'Exceeding Expectations: 3 students, 30%' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Meeting Expectations: 7 students, 70%' })
    ).toBeInTheDocument();
    expect(screen.getByText('10 graded students in this selection')).toBeInTheDocument();
  });

  it('falls back to a neutral colour for an invalid configuration colour', () => {
    const { container } = render(
      <GradeDistributionChart grades={[{ ...grades[0], color: 'javascript:alert(1)' }]} />
    );
    const bar = container.querySelector('[style*="background-color"]');
    expect(bar).toHaveStyle({ backgroundColor: '#6b7280' });
  });

  it('shows the empty state instead of an empty chart', () => {
    render(<GradeDistributionChart grades={[]} />);
    expect(screen.getByText('No grades to show')).toBeInTheDocument();
  });
});
