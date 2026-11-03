import type {
  AccountDirectoryRow,
  PermissionCatalogueItem,
  RoleScope,
  RoleWithPermissionsRow,
  StaffType,
  UserPermissionProfile,
} from './types';

/**
 * Pure helpers for Zeraki-parity Accounts, Roles, Permissions & Section Heads.
 *
 * Grounded in the extracted Zeraki web bundle:
 * - `chunk-XOUYY76Z.js`: `Fe` staff types (`TEACHER`, `OFFICIAL`, `WORKER`),
 *   `scope` (`GLOBAL` vs `CUSTOM`), and `UserPermissionsComponent` tabs
 *   (`granted`, `eligible`, `restricted`) + `buildOverrides()`.
 * - `chunk-4ELYURC5.js`: permission catalogue across 7 categories.
 * - `chunk-POC2O2ZL.js`: `Te` form-level map (`PRE_SCHOOL` .. `MYP`).
 */

export type AccountStatusFilter = 'all' | 'active' | 'inactive' | 'revoked';
export type StaffTypeFilter = 'all' | StaffType;
export type UserPermissionsTab = 'granted' | 'eligible' | 'restricted';

export interface RoleSummary {
  /** Normalized lowercase role key (`unassigned` when `role` is null/blank). */
  key: string;
  /** Human-readable label for the role. */
  label: string;
  description?: string;
  staffType?: StaffType;
  scope?: RoleScope;
  permissionCount?: number;
  total: number;
  active: number;
  inactive: number;
}

export interface AccountStats {
  total: number;
  active: number;
  inactive: number;
  revoked: number;
  roleCount: number;
}

export interface AccountFilterCriteria {
  query?: string;
  /** Role key (`all` or empty for no role filter). */
  role?: string;
  status?: AccountStatusFilter;
  staffType?: StaffTypeFilter;
}

export interface PermissionCategoryGroup {
  category_code: string;
  category_name: string;
  permissions: PermissionCatalogueItem[];
}

export const STAFF_TYPE_OPTIONS: ReadonlyArray<{ value: StaffType; label: string }> = [
  { value: 'TEACHER', label: 'Teaching staff' },
  { value: 'OFFICIAL', label: 'Official / BOM / Administration' },
  { value: 'WORKER', label: 'Non-teaching staff' },
];

export const FORM_LEVEL_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'PRE_SCHOOL', label: 'Pre-School' },
  { value: 'KINDERGARTEN', label: 'Kindergarten' },
  { value: 'LOWER_PRIMARY', label: 'Lower Primary' },
  { value: 'UPPER_PRIMARY', label: 'Upper Primary' },
  { value: 'PRIMARY', label: 'Primary' },
  { value: 'JUNIOR_SCHOOL', label: 'Junior School' },
  { value: 'SENIOR_SCHOOL', label: 'Senior School' },
  { value: 'SECONDARY', label: 'Secondary' },
  { value: 'LOWER_SECONDARY', label: 'Lower Secondary' },
  { value: 'UPPER_SECONDARY', label: 'Upper Secondary' },
  { value: 'O_LEVEL', label: 'O-Level' },
  { value: 'A_LEVEL', label: 'A-Level' },
  { value: 'COLLEGE', label: 'College' },
  { value: 'DP', label: 'IB Diploma Programme' },
  { value: 'MYP', label: 'IB Middle Years Programme' },
];

const FORM_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  FORM_LEVEL_OPTIONS.map((item) => [item.value, item.label])
);

const KNOWN_ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  superadmin: 'Super admin',
  'super admin': 'Super admin',
  admin: 'Administrator',
  administrator: 'Administrator',
  owner: 'Owner',
  director: 'Director',
  principal: 'Principal',
  deputy_principal: 'Deputy principal',
  'deputy principal': 'Deputy principal',
  teacher: 'Teacher',
  secretary: 'Secretary',
  bursar: 'Bursar',
  accountant: 'Accountant',
  librarian: 'Librarian',
  messenger: 'Messenger',
  worker: 'Non-teaching staff',
  official: 'Official',
  student: 'Student',
  parent: 'Parent',
};

export const UNASSIGNED_ROLE_KEY = 'unassigned';

/**
 * Canonical lowercase key for grouping and URLs. Whitespace and underscores
 * are collapsed so `'DEPUTY_PRINCIPAL'`, `'Deputy Principal'` and
 * `'deputy  principal'` resolve to the same role bucket.
 */
export function roleKey(role: string | null | undefined): string {
  const cleaned = (role ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (cleaned === 'superadmin') return 'super admin';
  if (cleaned === 'administrator') return 'admin';
  return cleaned.length > 0 ? cleaned : UNASSIGNED_ROLE_KEY;
}

export function roleLabel(role: string | null | undefined): string {
  const key = roleKey(role);
  return roleLabelFromKey(key);
}

function roleLabelFromKey(key: string): string {
  if (key === UNASSIGNED_ROLE_KEY) return 'Unassigned';
  const direct = KNOWN_ROLE_LABELS[key] ?? KNOWN_ROLE_LABELS[key.replace(/ /g, '_')];
  if (direct) return direct;
  return key.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function staffTypeLabel(staffType: StaffType | null | undefined): string {
  switch (staffType) {
    case 'TEACHER':
      return 'Teaching staff';
    case 'WORKER':
      return 'Non-teaching staff';
    case 'OFFICIAL':
    default:
      return 'Official / Administration';
  }
}

export function inferStaffTypeFromRole(role: string | null | undefined): StaffType {
  const key = roleKey(role);
  if (key === 'teacher') return 'TEACHER';
  if (['worker', 'secretary', 'messenger', 'librarian'].includes(key)) return 'WORKER';
  return 'OFFICIAL';
}

export function formLevelLabel(formLevel: string | null | undefined): string {
  if (!formLevel) return '—';
  return FORM_LEVEL_LABELS[formLevel] ?? formLevel;
}

export function accountDisplayName(row: Pick<AccountDirectoryRow, 'full_name'>): string {
  const trimmed = (row.full_name ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'Unnamed account';
}

/** Deterministic `DD Mon YYYY` date string in UTC, or `'—'` when unparseable. */
export function formatAccountDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function summarizeRoles(
  rows: AccountDirectoryRow[],
  rolesCatalogue: RoleWithPermissionsRow[] = []
): RoleSummary[] {
  const buckets = new Map<string, RoleSummary>();

  for (const roleRow of rolesCatalogue) {
    const key = roleKey(roleRow.role_key);
    buckets.set(key, {
      key,
      label: roleRow.display_name || roleLabelFromKey(key),
      description: roleRow.description,
      staffType: roleRow.staff_type,
      scope: roleRow.scope,
      permissionCount: roleRow.permission_codes.length,
      total: 0,
      active: 0,
      inactive: 0,
    });
  }

  for (const row of rows) {
    const key = roleKey(row.role);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        label: roleLabelFromKey(key),
        staffType: row.staff_type ?? inferStaffTypeFromRole(row.role),
        scope: 'CUSTOM',
        total: 0,
        active: 0,
        inactive: 0,
      };
      buckets.set(key, bucket);
    }
    bucket.total += 1;
    if (row.is_active) bucket.active += 1;
    else bucket.inactive += 1;
  }

  return Array.from(buckets.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.label.localeCompare(b.label);
  });
}

export function computeAccountStats(rows: AccountDirectoryRow[]): AccountStats {
  let active = 0;
  let inactive = 0;
  let revoked = 0;
  const roles = new Set<string>();

  for (const row of rows) {
    if (row.is_active) active += 1;
    else inactive += 1;
    if (row.access_revoked) revoked += 1;
    roles.add(roleKey(row.role));
  }

  return {
    total: rows.length,
    active,
    inactive,
    revoked,
    roleCount: roles.size,
  };
}

export function filterAccounts(
  rows: AccountDirectoryRow[],
  criteria: AccountFilterCriteria = {}
): AccountDirectoryRow[] {
  const query = (criteria.query ?? '').trim().toLowerCase();
  const roleFilter =
    criteria.role && criteria.role !== 'all' ? roleKey(criteria.role) : null;
  const status = criteria.status ?? 'all';
  const staffType = criteria.staffType ?? 'all';

  return rows.filter((row) => {
    if (roleFilter && roleKey(row.role) !== roleFilter) return false;
    const rowStaffType = row.staff_type ?? inferStaffTypeFromRole(row.role);
    if (staffType !== 'all' && rowStaffType !== staffType) return false;
    if (status === 'active' && (!row.is_active || row.access_revoked)) return false;
    if (status === 'inactive' && row.is_active) return false;
    if (status === 'revoked' && !row.access_revoked) return false;
    if (!query) return true;

    const name = accountDisplayName(row).toLowerCase();
    const email = (row.email ?? '').toLowerCase();
    const label = roleLabel(row.role).toLowerCase();
    const rawRole = (row.role ?? '').toLowerCase();
    return (
      name.includes(query) ||
      email.includes(query) ||
      label.includes(query) ||
      rawRole.includes(query)
    );
  });
}

export function findRoleSummary(
  rows: AccountDirectoryRow[],
  targetRole: string | null | undefined,
  rolesCatalogue: RoleWithPermissionsRow[] = []
): RoleSummary | null {
  const target = roleKey(targetRole);
  return summarizeRoles(rows, rolesCatalogue).find((item) => item.key === target) ?? null;
}

export function groupPermissionsByCategory(
  items: PermissionCatalogueItem[],
  searchQuery = ''
): PermissionCategoryGroup[] {
  const query = searchQuery.trim().toLowerCase();
  const groups = new Map<string, PermissionCategoryGroup>();

  for (const item of items) {
    if (
      query &&
      !item.display_name.toLowerCase().includes(query) &&
      !item.code.toLowerCase().includes(query) &&
      !item.category_name.toLowerCase().includes(query)
    ) {
      continue;
    }
    let group = groups.get(item.category_code);
    if (!group) {
      group = {
        category_code: item.category_code,
        category_name: item.category_name,
        permissions: [],
      };
      groups.set(item.category_code, group);
    }
    group.permissions.push(item);
  }

  return Array.from(groups.values());
}

/**
 * Compute the three Zeraki `UserPermissionsComponent` tabs (`granted`,
 * `eligible`, `restricted`) from the full catalogue and a user's permission
 * profile (`chunk-XOUYY76Z.js`).
 */
export function computeUserPermissionTabSets(
  catalogue: PermissionCatalogueItem[],
  profile: UserPermissionProfile
): Record<UserPermissionsTab, Set<string>> {
  const granted = new Set<string>(profile.effective_permissions);
  const restricted = new Set<string>(profile.denied_overrides);
  const eligible = new Set<string>();

  for (const item of catalogue) {
    if (!granted.has(item.code) && !restricted.has(item.code)) {
      eligible.add(item.code);
    }
  }

  return { granted, eligible, restricted };
}

/**
 * Mirror Zeraki's `buildOverrides()` (`chunk-XOUYY76Z.js`):
 * - `toGrant` (from the Eligible tab) becomes `GRANT` overrides.
 * - `toUnrestrict` (from the Restricted tab) clears `DENY` overrides.
 * - `toRemove` (from the Granted tab):
 *   * if the permission was only held via a `GRANT` override, clear the override;
 *   * if the permission is part of the user's role, add a `DENY` override (and
 *     clear any `GRANT` override).
 */
export function buildUserPermissionOverrides(params: {
  rolePermissions: Iterable<string>;
  grantedOverrides: Iterable<string>;
  toGrant: Iterable<string>;
  toRemove: Iterable<string>;
  toUnrestrict: Iterable<string>;
}): {
  grantCodes: string[];
  denyCodes: string[];
  clearCodes: string[];
} {
  const roleSet = new Set(params.rolePermissions);
  const grantOverrideSet = new Set(params.grantedOverrides);
  const clearSet = new Set(params.toUnrestrict);
  const denySet = new Set<string>();

  for (const code of params.toRemove) {
    const hadGrantOverride = grantOverrideSet.has(code);
    if (hadGrantOverride) clearSet.add(code);
    if (!hadGrantOverride || roleSet.has(code)) {
      denySet.add(code);
    }
  }

  return {
    grantCodes: Array.from(new Set(params.toGrant)).sort(),
    denyCodes: Array.from(denySet).sort(),
    clearCodes: Array.from(clearSet).sort(),
  };
}
