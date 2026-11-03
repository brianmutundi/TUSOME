import { describe, expect, it } from 'vitest';
import { canAccessRoute, ROUTE_GUARDS } from './routePermissions';

// Mirrors the built-in teacher catalog entry (no admin/finance/staff-management rights).
const TEACHER_PERMISSIONS = [
  'view-teacher-dashboard',
  'access-exams',
  'view-my-classes',
  'access-printouts',
  'view-merit-list',
  'view-evaluation-report',
  'view-report-forms',
  'view-class-list',
  'view-printout-filters',
  'view-transcripts',
  'access-classes',
  'access-subjects',
  'access-students',
  'search-student',
  'view-student-profile',
  'view-student-analysis',
];

describe('canAccessRoute — teacher scoping', () => {
  it.each([
    '/analytics/accounts',
    '/analytics/accounts/teacher',
    '/analytics/teachers',
    '/analytics/staff',
    '/analytics/settings',
    '/analytics/finance',
    '/analytics/payroll',
    '/analytics/leave',
    '/analytics/messages',
    '/analytics/timetable',
    '/analytics/audit-log',
    '/analytics/data-retention',
  ])('denies teacher forced URL %s', (url) => {
    expect(canAccessRoute(TEACHER_PERMISSIONS, url)).toBe(false);
  });

  it.each([
    '/analytics',
    '/analytics/exams',
    '/analytics/students',
    '/analytics/classes',
    '/analytics/subjects',
    '/analytics/report-forms',
    '/analytics/merit-list',
  ])('allows teacher URL %s', (url) => {
    expect(canAccessRoute(TEACHER_PERMISSIONS, url)).toBe(true);
  });

  it('denies when permissions are missing entirely', () => {
    expect(canAccessRoute(null, '/analytics/finance')).toBe(false);
    expect(canAccessRoute([], '/analytics/accounts')).toBe(false);
  });

  it('uses the most specific prefix and allows unknown routes for RPC enforcement', () => {
    expect(canAccessRoute(TEACHER_PERMISSIONS, '/analytics/not-a-real-page')).toBe(true);
    expect(canAccessRoute(['view-fees'], '/analytics/finance/balances')).toBe(true);
    expect(canAccessRoute(TEACHER_PERMISSIONS, '/analytics/finance/balances')).toBe(false);
  });
});

describe('ROUTE_GUARDS integrity', () => {
  it('has unique prefixes', () => {
    const prefixes = ROUTE_GUARDS.map((g) => g.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});
