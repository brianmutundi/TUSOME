import { describe, expect, it } from 'vitest';
import {
  AnalyticsContractError,
  isUuid,
  normalizeAccountDirectory,
  normalizeClassPerformance,
  normalizeGradeDistribution,
  normalizeMarkSheet,
  normalizeMostImproved,
  normalizePermissionCatalogue,
  normalizeRolesWithPermissions,
  normalizeSectionHeads,
  normalizeStudentExamHistory,
  normalizeStudentReport,
  normalizeSubjectPerformance,
  normalizeUserPermissionProfile,
} from './guards';

const classRow = {
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
  passed_count: 2,
};

describe('normalizeClassPerformance', () => {
  it('maps a valid row without changing values', () => {
    expect(normalizeClassPerformance([classRow])).toEqual([classRow]);
  });

  it('accepts numeric strings from PostgREST', () => {
    const row = { ...classRow, total_score: '116', mean_percentage: '58.5' };
    expect(normalizeClassPerformance([row])[0].total_score).toBe(116);
    expect(normalizeClassPerformance([row])[0].mean_percentage).toBe(58.5);
  });

  it('treats a null stream and grade as optional', () => {
    const row = { ...classRow, stream_name: null, overall_grade: null, overall_points: null };
    expect(normalizeClassPerformance([row])[0]).toMatchObject({
      stream_name: null,
      overall_grade: null,
      overall_points: null,
    });
  });

  it('rejects a missing required field', () => {
    const { student_name: _omitted, ...row } = classRow;
    expect(() => normalizeClassPerformance([row])).toThrow(AnalyticsContractError);
  });

  it('rejects a non-numeric score', () => {
    expect(() => normalizeClassPerformance([{ ...classRow, mean_percentage: 'n/a' }])).toThrow(
      AnalyticsContractError
    );
  });

  it('rejects a non-array payload', () => {
    expect(() => normalizeClassPerformance({ data: [] })).toThrow(AnalyticsContractError);
  });
});

describe('normalizeGradeDistribution', () => {
  it('maps buckets', () => {
    const rows = normalizeGradeDistribution([
      {
        grade_code: 'EE',
        grade_name: 'Exceeding Expectations',
        broad_grade: 'EE',
        count: 2,
        percentage: 50,
        color: '#16a34a',
      },
    ]);
    expect(rows[0].grade_code).toBe('EE');
    expect(rows[0].count).toBe(2);
  });
});

describe('normalizeSubjectPerformance', () => {
  it('turns a null subject code into an empty string', () => {
    const [row] = normalizeSubjectPerformance([
      {
        subject_id: 'a3000000-0000-0000-0000-000000000001',
        subject_name: 'Mathematics',
        subject_code: null,
        total_students: 2,
        mean_score: 68,
        highest_score: 90,
        lowest_score: 40,
        pass_count: 2,
        pass_rate: 100,
        ee_count: 0,
        me_count: 2,
        ae_count: 0,
        be_count: 0,
      },
    ]);
    expect(row.subject_code).toBe('');
  });
});

describe('normalizeStudentReport', () => {
  const report = {
    student: {
      id: 'a5000000-0000-0000-0000-000000000001',
      admission_no: 'A-001',
      name: 'Alice A',
      class: 'Class A1',
      stream: 'Blue',
      gender: 'Female',
    },
    school: { name: 'School A' },
    exam: { name: 'Exam', term: 'Term 1', year: 2026, assessment_component: 'end_term' },
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
    ],
    summary: {
      total_score: 76,
      mean_percentage: 76,
      subjects_count: 1,
      position: 1,
      total_in_class: 2,
    },
  };

  it('accepts a report from an older database without academic_year', () => {
    expect(normalizeStudentReport(report).student.academic_year).toBeNull();
  });

  it('keeps the enrollment academic_year when present', () => {
    const extended = {
      ...report,
      student: { ...report.student, academic_year: 2025 },
    };
    expect(normalizeStudentReport(extended).student.academic_year).toBe(2025);
  });

  it('rejects a report with a missing summary', () => {
    const { summary: _omitted, ...broken } = report;
    expect(() => normalizeStudentReport(broken)).toThrow(AnalyticsContractError);
  });
});

describe('normalizeMarkSheet', () => {
  const row = {
    student_id: 'a5000000-0000-0000-0000-000000000001',
    admission_no: 'A-001',
    student_name: 'Alice A',
    class_name: 'Class A1',
    stream_name: null,
    subject_id: 'a3000000-0000-0000-0000-000000000001',
    subject_name: 'Mathematics',
    subject_code: null,
    score: '85',
    grade_code: null,
    grade_name: null,
    points: null,
  };

  it('accepts numeric strings and nullable grade fields', () => {
    const [parsed] = normalizeMarkSheet([row]);
    expect(parsed.score).toBe(85);
    expect(parsed.stream_name).toBeNull();
    expect(parsed.grade_code).toBeNull();
  });

  it('rejects a malformed row', () => {
    expect(() => normalizeMarkSheet([{ ...row, subject_name: '' }])).toThrow(
      AnalyticsContractError
    );
  });
});

describe('normalizeStudentExamHistory', () => {
  const row = {
    exam_id: 'e1',
    exam_name: 'Mid Term',
    term: 'Term 1',
    academic_year: 2026,
    assessment_component: null,
    total_score: 400,
    mean_score: 66.67,
    subjects_count: 6,
    overall_grade: 'B',
    overall_points: 5,
    position: 3,
    total_in_exam: 40,
  };

  it('maps a valid history row', () => {
    expect(normalizeStudentExamHistory([row])[0]).toMatchObject({ exam_id: 'e1', position: 3 });
  });

  it('rejects a non-numeric position', () => {
    expect(() => normalizeStudentExamHistory([{ ...row, position: 'third' }])).toThrow(
      AnalyticsContractError
    );
  });
});

describe('normalizeMostImproved', () => {
  const row = {
    student_id: 'a5000000-0000-0000-0000-000000000001',
    admission_no: 'A-001',
    student_name: 'Alice A',
    stream_name: 'Blue',
    current_mean: 72,
    previous_mean: 55,
    delta: 17,
    previous_exam_name: 'Mid Term',
  };

  it('maps a valid row', () => {
    expect(normalizeMostImproved([row])[0]).toMatchObject({ delta: 17 });
  });

  it('rejects a missing previous exam name', () => {
    const { previous_exam_name: _omitted, ...broken } = row;
    expect(() => normalizeMostImproved([broken])).toThrow(AnalyticsContractError);
  });
});

describe('normalizeAccountDirectory', () => {
  const row = {
    account_id: 'a0000000-0000-0000-0000-0000000000f1',
    full_name: 'Alice Admin',
    email: 'alice@school.local',
    role: 'admin',
    staff_type: 'OFFICIAL',
    is_active: true,
    access_revoked: false,
    granted_overrides: 1,
    denied_overrides: 0,
    created_at: '2026-01-15T08:00:00Z',
  };

  it('maps a valid account row and preserves nullable fields', () => {
    const [first, second] = normalizeAccountDirectory([
      row,
      { ...row, account_id: 'a0000000-0000-0000-0000-0000000000f2', full_name: null, role: '' },
    ]);
    expect(first).toEqual(row);
    expect(second.full_name).toBeNull();
    expect(second.role).toBeNull();
  });

  it('rejects a non-boolean is_active or invalid staff_type', () => {
    expect(() => normalizeAccountDirectory([{ ...row, is_active: 'true' }])).toThrow(
      AnalyticsContractError
    );
    expect(() => normalizeAccountDirectory([{ ...row, staff_type: 'INVALID' }])).toThrow(
      AnalyticsContractError
    );
  });

  it('rejects a missing created_at', () => {
    expect(() => normalizeAccountDirectory([{ ...row, created_at: '' }])).toThrow(
      AnalyticsContractError
    );
  });
});

describe('normalizePermissionCatalogue, normalizeRolesWithPermissions, normalizeUserPermissionProfile, normalizeSectionHeads', () => {
  it('validates permission catalogue, roles, user permission profile and section heads', () => {
    expect(
      normalizePermissionCatalogue([
        {
          code: 'view-user-roles',
          category_code: 'settings',
          category_name: 'Settings',
          display_name: 'View user roles',
          sort_order: 85,
        },
      ])[0].code
    ).toBe('view-user-roles');

    expect(
      normalizeRolesWithPermissions([
        {
          role_id: null,
          role_key: 'admin',
          display_name: 'Administrator',
          description: 'Full access',
          staff_type: 'OFFICIAL',
          scope: 'GLOBAL',
          member_count: 1,
          active_count: 1,
          inactive_count: 0,
          permission_codes: ['view-user-roles'],
        },
      ])[0].scope
    ).toBe('GLOBAL');

    expect(
      normalizeUserPermissionProfile({
        account_id: 'f1',
        full_name: 'Alice',
        email: 'alice@school.local',
        role: 'admin',
        staff_type: 'OFFICIAL',
        is_active: true,
        access_revoked: false,
        role_permissions: ['view-user-roles'],
        granted_overrides: [],
        denied_overrides: [],
        effective_permissions: ['view-user-roles'],
      }).effective_permissions
    ).toEqual(['view-user-roles']);

    expect(
      normalizeSectionHeads([
        {
          section_head_id: 'sh1',
          form_level: 'JUNIOR_SCHOOL',
          user_id: 'f1',
          user_full_name: 'Alice',
          user_email: 'alice@school.local',
          user_role: 'teacher',
          staff_type: 'TEACHER',
          created_at: '2026-01-15T08:00:00Z',
        },
      ])[0].form_level
    ).toBe('JUNIOR_SCHOOL');
  });
});

describe('isUuid', () => {  it('accepts fixture-style UUIDs', () => {
    expect(isUuid('a5000000-0000-0000-0000-000000000001')).toBe(true);
  });

  it('rejects malformed or injected values', () => {
    expect(isUuid('1 OR 1=1')).toBe(false);
    expect(isUuid('a5000000-0000-0000-0000-00000000000')).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid('a5000000-0000-0000-0000-00000000000z')).toBe(false);
  });
});
