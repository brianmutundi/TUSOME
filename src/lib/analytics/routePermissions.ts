/**
 * Route-level permission guards.
 *
 * Maps a route prefix to the set of permission codes that grant access.
 * An empty array means "any authenticated school user may view".
 * A user is allowed if they hold ANY of the listed codes, OR they are a
 * platform super admin (who is restricted to /analytics/schools anyway).
 *
 * Used by AuthGate to redirect unauthorised direct-URL access.
 */

export interface RouteGuard {
  /** Route prefix (with leading slash). */
  prefix: string;
  /** Permission codes, any of which grants access. Empty = any authenticated user. */
  anyOf: string[];
}

export const ROUTE_GUARDS: RouteGuard[] = [
  // Platform
  { prefix: '/analytics/schools', anyOf: [] }, // super admin only, handled separately

  // Accounts & roles
  { prefix: '/analytics/accounts', anyOf: ['view-user-roles', 'edit-user-roles', 'can-manage-user-permissions', 'edit-teacher-profile', 'add-teachers'] },
  { prefix: '/analytics/audit-log', anyOf: ['view-user-roles', 'can-manage-user-permissions'] },
  { prefix: '/analytics/data-retention', anyOf: ['manage-retention'] },

  // Settings
  { prefix: '/analytics/settings', anyOf: ['access-settings'] },

  // Students
  { prefix: '/analytics/students', anyOf: ['access-students'] },
  { prefix: '/analytics/student-groups', anyOf: ['access-students', 'edit-student-groups'] },
  { prefix: '/analytics/parents', anyOf: ['access-students'] },
  { prefix: '/analytics/pathways', anyOf: ['access-students'] },
  { prefix: '/analytics/residences', anyOf: ['access-students', 'add-edit-student-residences'] },

  // Academics
  { prefix: '/analytics/exams', anyOf: ['access-exams'] },
  { prefix: '/analytics/subjects', anyOf: ['access-subjects'] },
  { prefix: '/analytics/subject-papers', anyOf: ['access-subjects'] },
  { prefix: '/analytics/classes', anyOf: ['access-classes'] },
  { prefix: '/analytics/timetable', anyOf: ['manage-timetable'] },
  { prefix: '/analytics/lesson-plans', anyOf: [] },
  { prefix: '/analytics/curriculum-coverage', anyOf: [] },
  { prefix: '/analytics/exam-comments', anyOf: [] },

  // Attendance & conduct
  { prefix: '/analytics/daily-attendance', anyOf: [] },
  { prefix: '/analytics/attendance', anyOf: [] },
  { prefix: '/analytics/behaviour', anyOf: [] },
  { prefix: '/analytics/counselling', anyOf: [] },
  { prefix: '/analytics/medical', anyOf: [] },

  // Staff
  { prefix: '/analytics/staff', anyOf: ['access-staff-bom-pa', 'access-teachers'] },
  { prefix: '/analytics/teachers', anyOf: ['access-teachers'] },
  { prefix: '/analytics/leave', anyOf: ['approve-leave'] },
  { prefix: '/analytics/duty-rosters', anyOf: [] },
  { prefix: '/analytics/teacher-workload', anyOf: [] },

  // Finance
  { prefix: '/analytics/finance', anyOf: ['view-fees', 'manage-fees'] },
  { prefix: '/analytics/fee-waivers', anyOf: ['view-fees', 'approve-fee-waiver'] },
  { prefix: '/analytics/billing', anyOf: ['view-fees', 'manage-fees'] },
  { prefix: '/analytics/wallet', anyOf: ['view-fees', 'manage-fees'] },
  { prefix: '/analytics/accounting', anyOf: ['approve-budget', 'close-fiscal-period'] },
  { prefix: '/analytics/bank-reconciliation', anyOf: ['view-fees', 'manage-fees'] },
  { prefix: '/analytics/budgets', anyOf: ['approve-budget'] },
  { prefix: '/analytics/fiscal-periods', anyOf: ['close-fiscal-period', 'reopen-fiscal-period'] },
  { prefix: '/analytics/payroll', anyOf: ['manage-payroll', 'approve-payroll', 'finalize-payroll'] },
  { prefix: '/analytics/salary-components', anyOf: ['manage-payroll'] },
  { prefix: '/analytics/employee-salaries', anyOf: ['manage-payroll'] },

  // Communication
  { prefix: '/analytics/messages', anyOf: ['compose-send-sms'] },
  { prefix: '/analytics/events', anyOf: [] },

  // Operations
  { prefix: '/analytics/library', anyOf: [] },
  { prefix: '/analytics/transport', anyOf: [] },
  { prefix: '/analytics/boarding', anyOf: [] },
  { prefix: '/analytics/sports', anyOf: [] },
  { prefix: '/analytics/trips', anyOf: [] },
  { prefix: '/analytics/opportunities', anyOf: [] },

  // Reports
  { prefix: '/analytics/analysis', anyOf: [] },
  { prefix: '/analytics/merit-list', anyOf: ['view-merit-list', 'access-printouts'] },
  { prefix: '/analytics/mark-sheet', anyOf: ['view-assessments', 'access-printouts'] },
  { prefix: '/analytics/report-forms', anyOf: ['view-report-forms', 'access-printouts'] },
  { prefix: '/analytics/transcript', anyOf: ['view-transcripts', 'access-printouts'] },
];

/**
 * Returns true when the given permission set allows viewing `pathname`.
 * Super admins are handled by the caller (restricted to /analytics/schools).
 */
export function canAccessRoute(
  permissions: string[] | null | undefined,
  pathname: string
): boolean {
  const permSet = new Set(permissions ?? []);
  // Find the most specific guard (longest prefix match).
  let guard: RouteGuard | null = null;
  let bestLen = -1;
  for (const g of ROUTE_GUARDS) {
    if (pathname === g.prefix || pathname.startsWith(g.prefix + '/')) {
      if (g.prefix.length > bestLen) {
        bestLen = g.prefix.length;
        guard = g;
      }
    }
  }
  if (!guard) return true; // unknown route -> allow (RPCs enforce)
  if (guard.anyOf.length === 0) return true; // any authenticated user
  return guard.anyOf.some((p) => permSet.has(p));
}
