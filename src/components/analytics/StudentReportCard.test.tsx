import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudentReportCard } from './StudentReportCard';
import type { StudentReportData } from '@/lib/analytics/types';

const report: StudentReportData = {
  student: {
    id: 'a5000000-0000-0000-0000-000000000001',
    admission_no: 'A-001',
    name: 'Alice A',
    class: 'Class A1',
    stream: 'Blue',
    academic_year: 2025,
    gender: 'Female',
  },
  school: { name: 'Analytics School A' },
  exam: {
    name: 'Published Exam',
    term: 'Term 1',
    year: 2026,
    assessment_component: 'end_term',
  },
  subjects: [
    {
      subject_id: 'a3000000-0000-0000-0000-000000000001',
      subject_name: 'Mathematics',
      subject_code: 'MAT',
      score: 76,
      percentage: 76,
      grade: 'ME',
      grade_name: 'Meeting Expectations',
      points: 3,
    },
    {
      subject_id: 'a3000000-0000-0000-0000-000000000002',
      subject_name: 'English',
      subject_code: null,
      score: 40,
      percentage: 40,
      grade: 'AE',
      grade_name: 'Approaching Expectations',
      points: 2,
    },
  ],
  summary: {
    total_score: 116,
    mean_percentage: 58,
    subjects_count: 2,
    position: 2,
    total_in_class: 2,
  },
};

describe('StudentReportCard', () => {
  it('renders the school, identity, enrollment and exam details', () => {
    render(<StudentReportCard report={report} />);
    expect(screen.getByText('Analytics School A')).toBeInTheDocument();
    expect(screen.getByText('Alice A')).toBeInTheDocument();
    expect(screen.getByText('A-001')).toBeInTheDocument();
    expect(screen.getByText('Class A1 · Blue')).toBeInTheDocument();
    expect(screen.getByText('Published Exam · Term 1 · 2026 · end_term')).toBeInTheDocument();
    expect(screen.getByText('(exam year 2026)')).toBeInTheDocument();
  });

  it('renders every subject with score, grade and points', () => {
    render(<StudentReportCard report={report} />);
    expect(screen.getByRole('rowheader', { name: /Mathematics/ })).toBeInTheDocument();
    expect(screen.getByText('76')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getAllByText('Meeting Expectations').length).toBeGreaterThan(0);
    expect(screen.getByText('Approaching Expectations')).toBeInTheDocument();
  });

  it('renders the summary with an ordinal position', () => {
    render(<StudentReportCard report={report} />);
    expect(screen.getByText('2nd')).toBeInTheDocument();
    expect(screen.getByText('of 2')).toBeInTheDocument();
    expect(screen.getByText('58%')).toBeInTheDocument();
  });

  it('explains when no subject marks exist', () => {
    render(
      <StudentReportCard
        report={{
          ...report,
          subjects: [],
          summary: { ...report.summary, subjects_count: 0, total_score: 0, mean_percentage: 0, position: null },
        }}
      />
    );
    expect(screen.getByText(/No subject marks were recorded/)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('uses the exam year when the student has no enrollment year', () => {
    render(
      <StudentReportCard
        report={{ ...report, student: { ...report.student, academic_year: null } }}
      />
    );
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.queryByText('(exam year 2026)')).not.toBeInTheDocument();
  });
});
