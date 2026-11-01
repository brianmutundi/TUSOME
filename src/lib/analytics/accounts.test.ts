import { describe, expect, it } from 'vitest';
import {
  accountDisplayName,
  buildUserPermissionOverrides,
  computeAccountStats,
  computeUserPermissionTabSets,
  filterAccounts,
  findRoleSummary,
   formatAccountDate,
  formLevelLabel,
  groupPermissionsByCategory,
  inferStaffTypeFromRole,
  roleKey,
  roleLabel,
  staffTypeLabel,
  summarizeRoles,
  UNASSIGNED_ROLE_KEY,
} from './accounts';
import type {
  AccountDirectoryRow,
  PermissionCatalogueItem,
  UserPermissionProfile,
} from './types';

const rows: AccountDirectoryRow[] = [
  {
    account_id: 'f1',
    full_name: 'Alice Admin',
    email: 'alice@school.local',
    role: 'admin',
    staff_type: 'OFFICIAL',
    is_active: true,
    access_revoked: false,
    granted_overrides: 0,
    denied_overrides: 0,
    created_at: '2026-01-15T08:00:00Z',
  },
  {
    account_id: 'f2',
    full_name: 'Bob Teacher',
    email: 'bob@school.local',
    role: 'TEACHER',
    staff_type: 'TEACHER',
    is_active: true,
    access_revoked: false,
    granted_overrides: 1,
    denied_overrides: 0,
    created_at: '2026-02-01T08:00:00Z',
  },
  {
    account_id: 'f3',
    full_name: 'Cara Teacher',
    email: 'cara@school.local',
    role: 'teacher',
    staff_type: 'TEACHER',
    is_active: false,
    access_revoked: true,
    granted_overrides: 0,
    denied_overrides: 2,
    created_at: '2026-03-01T08:00:00Z',
  },
  {
    account_id: 'f4',
    full_name: 'Dan Deputy',
    email: 'dan@school.local',
    role: 'DEPUTY_PRINCIPAL',
    staff_type: 'OFFICIAL',
    is_active: true,
    access_revoked: false,
    granted_overrides: 0,
    denied_overrides: 0,
    created_at: '2026-04-01T08:00:00Z',
  },
  {
    account_id: 'f5',
    full_name: null,
    email: null,
    role: null,
    staff_type: 'WORKER',
    is_active: false,
    access_revoked: false,
    granted_overrides: 0,
    denied_overrides: 0,
    created_at: '2026-05-01T08:00:00Z',
  },
];

describe('roleKey, roleLabel, staffTypeLabel and formLevelLabel', () => {
  it('collapses case, underscores and whitespace into one canonical key', () => {
    expect(roleKey('DEPUTY_PRINCIPAL')).toBe('deputy principal');
    expect(roleKey('  Deputy   Principal ')).toBe('deputy principal');
    expect(roleKey('deputy-principal')).toBe('deputy principal');
    expect(roleKey('superadmin')).toBe('super admin');
    expect(roleKey('administrator')).toBe('admin');
    expect(roleKey(null)).toBe(UNASSIGNED_ROLE_KEY);
    expect(roleKey('   ')).toBe(UNASSIGNED_ROLE_KEY);
  });

  it('formats known Zeraki and TUSOME roles, staff types and form levels', () => {
    expect(roleLabel('admin')).toBe('Administrator');
    expect(roleLabel('super_admin')).toBe('Super admin');
    expect(roleLabel('superadmin')).toBe('Super admin');
    expect(roleLabel('DEPUTY_PRINCIPAL')).toBe('Deputy principal');
    expect(roleLabel('teacher')).toBe('Teacher');
    expect(roleLabel(null)).toBe('Unassigned');
    expect(roleLabel('exam_coordinator')).toBe('Exam Coordinator');

    expect(staffTypeLabel('TEACHER')).toBe('Teaching staff');
    expect(staffTypeLabel('WORKER')).toBe('Non-teaching staff');
    expect(staffTypeLabel('OFFICIAL')).toBe('Official / Administration');
    expect(inferStaffTypeFromRole('teacher')).toBe('TEACHER');
    expect(inferStaffTypeFromRole('secretary')).toBe('WORKER');
    expect(inferStaffTypeFromRole('principal')).toBe('OFFICIAL');

    expect(formLevelLabel('JUNIOR_SCHOOL')).toBe('Junior School');
    expect(formLevelLabel('DP')).toBe('IB Diploma Programme');
    expect(formLevelLabel(null)).toBe('—');
  });
});

describe('accountDisplayName and formatAccountDate', () => {
  it('returns a clear fallback when full_name is missing or blank', () => {
    expect(accountDisplayName({ full_name: 'Alice' })).toBe('Alice');
    expect(accountDisplayName({ full_name: '   ' })).toBe('Unnamed account');
    expect(accountDisplayName({ full_name: null })).toBe('Unnamed account');
  });

  it('formats ISO timestamps deterministically in UTC and guards invalid input', () => {
    expect(formatAccountDate('2026-01-15T08:00:00Z')).toBe('15 Jan 2026');
    expect(formatAccountDate('not-a-date')).toBe('—');
    expect(formatAccountDate(null)).toBe('—');
  });
});

describe('summarizeRoles and computeAccountStats', () => {
  it('groups by canonical role key and sorts by count descending then label', () => {
    const summary = summarizeRoles(rows);
    expect(summary).toEqual([
      {
        key: 'teacher',
        label: 'Teacher',
        staffType: 'TEACHER',
        scope: 'CUSTOM',
        total: 2,
        active: 1,
        inactive: 1,
      },
      {
        key: 'admin',
        label: 'Administrator',
        staffType: 'OFFICIAL',
        scope: 'CUSTOM',
        total: 1,
        active: 1,
        inactive: 0,
      },
      {
        key: 'deputy principal',
        label: 'Deputy principal',
        staffType: 'OFFICIAL',
        scope: 'CUSTOM',
        total: 1,
        active: 1,
        inactive: 0,
      },
      {
        key: 'unassigned',
        label: 'Unassigned',
        staffType: 'WORKER',
        scope: 'CUSTOM',
        total: 1,
        active: 0,
        inactive: 1,
      },
    ]);
  });

  it('computes total, active, inactive, revoked and distinct role counts', () => {
    expect(computeAccountStats(rows)).toEqual({
      total: 5,
      active: 3,
      inactive: 2,
      revoked: 1,
      roleCount: 4,
    });
    expect(computeAccountStats([])).toEqual({
      total: 0,
      active: 0,
      inactive: 0,
      revoked: 0,
      roleCount: 0,
    });
  });

  it('looks up a single role summary regardless of casing or separator', () => {
    expect(findRoleSummary(rows, 'Deputy_Principal')?.total).toBe(1);
    expect(findRoleSummary(rows, 'nonexistent')).toBeNull();
  });
});

describe('filterAccounts', () => {
  it('filters by role key, staffType, status (including revoked) and search query (name, email, role)', () => {
    expect(filterAccounts(rows, { role: 'teacher' }).map((r) => r.account_id)).toEqual([
      'f2',
      'f3',
    ]);
    expect(
      filterAccounts(rows, { role: 'teacher', status: 'active' }).map((r) => r.account_id)
    ).toEqual(['f2']);
    expect(filterAccounts(rows, { status: 'revoked' }).map((r) => r.account_id)).toEqual([
      'f3',
    ]);
    expect(filterAccounts(rows, { staffType: 'WORKER' }).map((r) => r.account_id)).toEqual([
      'f5',
    ]);
    expect(filterAccounts(rows, { query: 'bob@school.local' }).map((r) => r.account_id)).toEqual([
      'f2',
    ]);
    expect(filterAccounts(rows, { query: 'administrator' }).map((r) => r.account_id)).toEqual([
      'f1',
    ]);
    expect(filterAccounts(rows, { query: 'unnamed' }).map((r) => r.account_id)).toEqual(['f5']);
  });
});

describe('permissions catalogue & per-user overrides helpers', () => {
  const catalogue: PermissionCatalogueItem[] = [
    {
      code: 'view-admin-dashboard',
      category_code: 'dashboard',
      category_name: 'Dashboard',
      display_name: 'View admin dashboard',
      sort_order: 10,
    },
    {
      code: 'manage-exams',
      category_code: 'exams',
      category_name: 'Exams & Grading',
      display_name: 'Manage exams',
      sort_order: 20,
    },
    {
      code: 'delete-exam',
      category_code: 'exams',
      category_name: 'Exams & Grading',
      display_name: 'Delete exams',
      sort_order: 21,
    },
    {
      code: 'edit-user-roles',
      category_code: 'settings',
      category_name: 'Settings & User Roles',
      display_name: 'Create, edit and delete user roles',
      sort_order: 30,
    },
  ];

  const profile: UserPermissionProfile = {
    account_id: 'f2',
    full_name: 'Bob Teacher',
    email: 'bob@school.local',
    role: 'teacher',
    staff_type: 'TEACHER',
    is_active: true,
    access_revoked: false,
    role_permissions: ['view-admin-dashboard', 'manage-exams'],
    granted_overrides: ['edit-user-roles'],
    denied_overrides: ['manage-exams'],
    effective_permissions: ['view-admin-dashboard', 'edit-user-roles'],
  };

  it('groups permissions by category and filters by search query', () => {
    expect(groupPermissionsByCategory(catalogue)).toHaveLength(3);
    expect(groupPermissionsByCategory(catalogue, 'delete')).toEqual([
      {
        category_code: 'exams',
        category_name: 'Exams & Grading',
        permissions: [catalogue[2]],
      },
      {
        category_code: 'settings',
        category_name: 'Settings & User Roles',
        permissions: [catalogue[3]],
      },
    ]);
  });

  it('computes Granted, Eligible and Restricted sets for a user profile', () => {
    const sets = computeUserPermissionTabSets(catalogue, profile);
    expect(Array.from(sets.granted)).toEqual(['view-admin-dashboard', 'edit-user-roles']);
    expect(Array.from(sets.restricted)).toEqual(['manage-exams']);
    expect(Array.from(sets.eligible)).toEqual(['delete-exam']);
  });

  it('builds grant, deny and clear arrays matching Zeraki buildOverrides()', () => {
    const result = buildUserPermissionOverrides({
      rolePermissions: profile.role_permissions,
      grantedOverrides: profile.granted_overrides,
      toGrant: ['delete-exam'],
      // Removing a role permission -> DENY; removing a grant-only override -> CLEAR
      toRemove: ['view-admin-dashboard', 'edit-user-roles'],
      toUnrestrict: ['manage-exams'],
    });
    expect(result).toEqual({
      grantCodes: ['delete-exam'],
      denyCodes: ['view-admin-dashboard'],
      clearCodes: ['edit-user-roles', 'manage-exams'],
    });
  });
});
