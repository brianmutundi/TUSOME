import { describe, expect, it } from 'vitest';
import { canAccessRoute, ROUTE_GUARDS } from './routePermissions';

const ALL_PERMISSIONS = [
  'access-classes', 'access-exams', 'access-printouts', 'access-settings', 'access-staff-bom-pa',
  'finalize-payroll', 'close-fiscal-period', 'reopen-fiscal-period',
  'access-students', 'access-subjects', 'access-teachers', 'add-edit-student-residences', 'add-students',
  'add-teachers', 'approve-budget', 'approve-fee-waiver', 'approve-leave', 'approve-payroll',
  'assign-class-supervisors', 'assign-class-teachers', 'assign-subject-teachers', 'can-manage-user-permissions',
  'compose-send-sms', 'create-edit-exam', 'delete-classes', 'delete-exam', 'delete-staff-bom-pa',
  'delete-stream-results', 'delete-students', 'delete-teachers', 'edit-classes', 'edit-printout-settings',
  'edit-school-options', 'edit-school-profile', 'edit-staff-bom-pa', 'edit-student-groups', 'edit-student-profile',
  'edit-teacher-profile', 'edit-term-dates', 'edit-user-roles', 'manage-classes', 'manage-exams',
  'manage-fees', 'manage-homework', 'manage-messages', 'manage-payroll', 'manage-retention', 'manage-timetable',
  'move-students', 'reply-parent-messages', 'search-student', 'view-admin-dashboard', 'view-assessments',
  'view-class-list', 'view-edit-coefficient-system', 'view-edit-compulsory-subjects', 'view-edit-grading-system',
  'view-edit-paper-ratios', 'view-evaluation-report', 'view-fees', 'view-merit-list', 'view-my-classes',
  'view-printout-filters', 'view-report-forms', 'view-school-options', 'view-school-profile', 'view-secretary-dashboard',
  'view-sensitive-student-data', 'view-staff-bom-pa-list', 'view-student-analysis', 'view-student-dashboard',
  'view-student-profile', 'view-teacher-dashboard', 'view-teacher-list', 'view-teacher-profile', 'view-term-dates',
  'view-transcripts', 'view-user-roles',
];

const TEACHER_PERMISSIONS = [
  'view-teacher-dashboard', 'access-exams', 'view-my-classes', 'access-printouts', 'view-merit-list',
  'view-evaluation-report', 'view-report-forms', 'view-class-list', 'view-printout-filters', 'view-transcripts',
  'access-classes', 'access-subjects', 'access-students', 'search-student', 'view-student-profile',
  'view-student-analysis', 'manage-homework', 'reply-parent-messages',
];

describe('route guard: fail closed', () => {
  it('denies unregistered (non-/analytics) routes', () => {
    expect(canAccessRoute(TEACHER_PERMISSIONS, '/foo')).toBe(false);
    expect(canAccessRoute(TEACHER_PERMISSIONS, '/api/schools')).toBe(false);
    expect(canAccessRoute(TEACHER_PERMISSIONS, '')).toBe(false);
  });

  it('denies when permissions failed to load (null)', () => {
    for (const g of ROUTE_GUARDS) {
      if (g.anyOf.length === 0) continue; // empty = any authenticated, handled separately
      expect(canAccessRoute(null, g.prefix)).toBe(false);
    }
  });

  it('denies when permission set is empty for gated routes', () => {
    for (const g of ROUTE_GUARDS) {
      if (g.anyOf.length === 0) continue;
      expect(canAccessRoute([], g.prefix)).toBe(false);
    }
  });
});

describe('route guard: role matrix (spot checks)', () => {
  it('admin (all codes) reaches every non-super-admin gated route', () => {
    for (const g of ROUTE_GUARDS) {
      if (g.superAdminOnly) continue;
      expect(canAccessRoute(ALL_PERMISSIONS, g.prefix)).toBe(true);
    }
  });

  it('teacher cannot reach finance/accounts/settings routes', () => {
    for (const url of ['/analytics/finance', '/analytics/accounts', '/analytics/settings', '/analytics/payroll', '/analytics/audit-log', '/analytics/data-retention']) {
      expect(canAccessRoute(TEACHER_PERMISSIONS, url)).toBe(false);
    }
  });

  it('teacher reaches their own routes', () => {
    for (const url of ['/analytics', '/analytics/exams', '/analytics/students', '/analytics/classes', '/analytics/homework']) {
      expect(canAccessRoute(TEACHER_PERMISSIONS, url)).toBe(true);
    }
  });
});

describe('route guard: unknown within /analytics is caught by catch-all', () => {
  it('allows authenticated users to the /analytics catch-all', () => {
    expect(canAccessRoute([], '/analytics/not-a-real-page')).toBe(true);
  });
});
