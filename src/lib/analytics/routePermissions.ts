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
  /** Permission codes, any of which grants access. Empty = see authenticatedOnly/superAdminOnly. */
  anyOf: string[];
  /** Explicitly open to any authenticated school user. Must be justified. */
  authenticatedOnly?: boolean;
  /** Restricted to platform super admins (handled in AuthGate). */
  superAdminOnly?: boolean;
}

export const ROUTE_GUARDS: RouteGuard[] = [
  // Platform
  { prefix: '/analytics/schools', anyOf: [], authenticatedOnly: true, superAdminOnly: true }, // super admin only
  { prefix: '/analytics', anyOf: [], authenticatedOnly: true }, // any authenticated school user (catch-all)

  // Accounts & roles
  { prefix: '/analytics/accounts', anyOf: ['view-user-roles', 'edit-user-roles', 'can-manage-user-permissions', 'edit-teacher-profile', 'add-teachers'] },
  { prefix: '/analytics/audit-log', anyOf: ['view-user-roles', 'can-manage-user-permissions'] },
  { prefix: '/analytics/data-retention', anyOf: ['manage-retention'] },

  // Settings
  { prefix: '/analytics/settings', anyOf: ['access-settings'] },

  // Students
  { prefix: '/analytics/students', anyOf: ['access-students'] },
  { prefix: '/analytics/student', anyOf: ['access-students'] },
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
  { prefix: '/analytics/homework', anyOf: ['manage-homework'] },
  { prefix: '/analytics/lesson-plans', anyOf: [], authenticatedOnly: true },
  { prefix: '/analytics/curriculum-coverage', anyOf: [], authenticatedOnly: true },
  { prefix: '/analytics/exam-comments', anyOf: [], authenticatedOnly: true },

  // Attendance & conduct
  { prefix: '/analytics/daily-attendance', anyOf: [], authenticatedOnly: true },
  { prefix: '/analytics/attendance', anyOf: [], authenticatedOnly: true },
  { prefix: '/analytics/behaviour', anyOf: [], authenticatedOnly: true },
  { prefix: '/analytics/counselling', anyOf: [], authenticatedOnly: true },
  { prefix: '/analytics/medical', anyOf: [], authenticatedOnly: true },

  // Staff
  { prefix: '/analytics/staff', anyOf: ['access-staff-bom-pa', 'access-teachers'] },
  { prefix: '/analytics/teachers', anyOf: ['access-teachers'] },
  { prefix: '/analytics/leave', anyOf: ['approve-leave'] },
  { prefix: '/analytics/duty-rosters', anyOf: [], authenticatedOnly: true },
  { prefix: '/analytics/teacher-workload', anyOf: [], authenticatedOnly: true },

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
  { prefix: '/analytics/payslips', anyOf: ['manage-payroll', 'view-fees'] },
  { prefix: '/analytics/salary-components', anyOf: ['manage-payroll'] },
  { prefix: '/analytics/employee-salaries', anyOf: ['manage-payroll'] },

  // Communication
  { prefix: '/analytics/messages', anyOf: ['compose-send-sms'] },
  { prefix: '/analytics/parent-messages', anyOf: ['reply-parent-messages'] },
  { prefix: '/analytics/events', anyOf: [], authenticatedOnly: true },

  // Operations
  { prefix: '/analytics/library', anyOf: [], authenticatedOnly: true },
  { prefix: '/analytics/transport', anyOf: [], authenticatedOnly: true },
  { prefix: '/analytics/boarding', anyOf: [], authenticatedOnly: true },
  { prefix: '/analytics/sports', anyOf: [], authenticatedOnly: true },
  { prefix: '/analytics/trips', anyOf: [], authenticatedOnly: true },
  { prefix: '/analytics/opportunities', anyOf: [], authenticatedOnly: true },

  // Reports
  { prefix: '/analytics/analysis', anyOf: [], authenticatedOnly: true },
  { prefix: '/analytics/marks', anyOf: ['access-exams'] },
  { prefix: '/analytics/merit-list', anyOf: ['view-merit-list', 'access-printouts'] },
  { prefix: '/analytics/mark-sheet', anyOf: ['view-assessments', 'access-printouts'] },
  { prefix: '/analytics/report-forms', anyOf: ['view-report-forms', 'access-printouts'] },
  { prefix: '/analytics/report', anyOf: ['view-report-forms', 'access-printouts'] },
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
  if (!guard) return false; // unknown route -> deny (fail closed)
  if (guard.superAdminOnly) return false; // super admin handled separately in AuthGate
  if (guard.anyOf.length === 0) {
    return guard.authenticatedOnly === true && permissions != null;
  }
  return guard.anyOf.some((p) => permSet.has(p));
}
