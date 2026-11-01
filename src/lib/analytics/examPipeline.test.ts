import { describe, expect, it } from 'vitest';
import {
  buildChangedMarkEntries,
  computeExamPipelineStats,
  examStatusLabel,
  filterExamPipeline,
  isExamEditable,
  summarizePublishReadiness,
} from './examPipeline';
import type {
  ExamMarkEntryRow,
  ExamPipelineRow,
  ExamPublishReadinessRow,
} from './types';

const sampleExams: ExamPipelineRow[] = [
  {
    exam_id: 'e1',
    name: 'Term 1 Mid-Term 2026',
    term: 'Term 1',
    academic_year: 2026,
    assessment_component: 'mid_term',
    status: 'published',
    class_ids: ['c1'],
    class_names: ['Grade 7'],
    enrolled_students: 30,
    students_with_marks: 30,
    subjects_with_marks: 4,
    total_marks_entered: 120,
    created_at: '2026-02-01T08:00:00Z',
  },
  {
    exam_id: 'e2',
    name: 'Term 2 Draft 2026',
    term: 'Term 2',
    academic_year: 2026,
    assessment_component: 'end_term',
    status: 'draft',
    class_ids: ['c1', 'c2'],
    class_names: ['Grade 7', 'Grade 8'],
    enrolled_students: 60,
    students_with_marks: 10,
    subjects_with_marks: 1,
    total_marks_entered: 10,
    created_at: '2026-05-01T08:00:00Z',
  },
  {
    exam_id: 'e3',
    name: 'Term 3 Reopened 2025',
    term: 'Term 3',
    academic_year: 2025,
    assessment_component: 'end_term',
    status: 'reopened',
    class_ids: ['c2'],
    class_names: ['Grade 8'],
    enrolled_students: 28,
    students_with_marks: 28,
    subjects_with_marks: 4,
    total_marks_entered: 112,
    created_at: '2025-11-01T08:00:00Z',
  },
];

describe('examStatusLabel and isExamEditable', () => {
  it('identifies published vs editable lifecycle states', () => {
    expect(examStatusLabel('published')).toBe('Published');
    expect(examStatusLabel('draft')).toBe('Draft');
    expect(examStatusLabel('reopened')).toBe('Reopened (Editable)');
    expect(isExamEditable('published')).toBe(false);
    expect(isExamEditable('draft')).toBe(true);
    expect(isExamEditable('reopened')).toBe(true);
    expect(isExamEditable('review')).toBe(true);
  });
});

describe('computeExamPipelineStats and filterExamPipeline', () => {
  it('computes published, editable and total mark counts', () => {
    expect(computeExamPipelineStats(sampleExams)).toEqual({
      total: 3,
      published: 1,
      editable: 2,
      totalMarksEntered: 242,
    });
  });

  it('filters by status, academic year and search query', () => {
    expect(filterExamPipeline(sampleExams, { status: 'draft' }).map((e) => e.exam_id)).toEqual([
      'e2',
    ]);
    expect(
      filterExamPipeline(sampleExams, { academicYear: '2025' }).map((e) => e.exam_id)
    ).toEqual(['e3']);
    expect(filterExamPipeline(sampleExams, { query: 'grade 8' }).map((e) => e.exam_id)).toEqual([
      'e2',
      'e3',
    ]);
  });
});

describe('summarizePublishReadiness', () => {
  const readiness: ExamPublishReadinessRow[] = [
    {
      subject_id: 's1',
      subject_name: 'Mathematics',
      subject_code: 'MAT',
      enrolled_students: 10,
      recorded_marks: 10,
      missing_marks: 0,
      mean_score: 72.5,
    },
    {
      subject_id: 's2',
      subject_name: 'English',
      subject_code: 'ENG',
      enrolled_students: 10,
      recorded_marks: 5,
      missing_marks: 5,
      mean_score: 64,
    },
  ];

  it('calculates completion percentage and publish eligibility', () => {
    expect(summarizePublishReadiness(readiness)).toEqual({
      totalSubjects: 2,
      subjectsWithMarks: 2,
      completeSubjects: 1,
      enrolledStudents: 10,
      totalRecordedMarks: 15,
      completionPercentage: 75,
      canPublish: true,
    });
    expect(summarizePublishReadiness([]).canPublish).toBe(false);
  });
});

describe('buildChangedMarkEntries', () => {
  const roster: ExamMarkEntryRow[] = [
    {
      student_id: 'stu-1',
      admission_no: '7001',
      student_name: 'Amina',
      class_id: 'c1',
      class_name: 'Grade 7',
      stream_id: 'st1',
      stream_name: 'Blue',
      score: 80,
      grade_code: 'EE',
      points: 4,
    },
    {
      student_id: 'stu-2',
      admission_no: '7002',
      student_name: 'Brian',
      class_id: 'c1',
      class_name: 'Grade 7',
      stream_id: 'st1',
      stream_name: 'Blue',
      score: null,
      grade_code: null,
      points: null,
    },
  ];

  it('emits only modified scores, supports clearing to null, and flags out-of-range values', () => {
    const valid = buildChangedMarkEntries(roster, {
      'stu-1': '',
      'stu-2': '74.5',
    });
    expect(valid).toEqual({
      entries: [
        { student_id: 'stu-1', score: null },
        { student_id: 'stu-2', score: 74.5 },
      ],
      invalidStudentIds: [],
    });

    const invalid = buildChangedMarkEntries(roster, {
      'stu-1': '80',
      'stu-2': '105',
    });
    expect(invalid).toEqual({
      entries: [],
      invalidStudentIds: ['stu-2'],
    });
  });
});
