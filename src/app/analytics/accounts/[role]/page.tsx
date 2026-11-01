'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AccountDirectoryTable,
  PermissionCategoryChecklist,
  type AccountRowSavePayload,
} from '@/components/analytics/AccountDirectoryTable';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  LoadingPanel,
  SelectField,
  StatCard,
  TextField,
} from '@/components/ui';
import {
  filterAccounts,
  findRoleSummary,
  inferStaffTypeFromRole,
  roleKey,
  roleLabel,
  STAFF_TYPE_OPTIONS,
  staffTypeLabel,
} from '@/lib/analytics/accounts';
import {
  describeAnalyticsError,
  getAccountDirectory,
  getPermissionCatalogue,
  getRolesWithPermissions,
  inviteOrCreateAccount,
  isAbortError,
  setUserAccessRevoked,
  updateAccountProfile,
  upsertCustomRole,
} from '@/lib/analytics/api';
import type {
  AccountDirectoryRow,
  PermissionCatalogueItem,
  RoleWithPermissionsRow,
  StaffType,
} from '@/lib/analytics/types';

type RoleDetailTab = 'members' | 'permissions';

function decodeRoleParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function RoleDetailsPage() {
  const params = useParams<{ role?: string | string[] }>();
  const requestedRole = decodeRoleParam(params?.role);
  const canonicalKey = roleKey(requestedRole);
  const fallbackLabel = roleLabel(requestedRole);

  const [activeTab, setActiveTab] = useState<RoleDetailTab>('members');
  const [rows, setRows] = useState<AccountDirectoryRow[]>([]);
  const [rolesCatalogue, setRolesCatalogue] = useState<RoleWithPermissionsRow[]>([]);
  const [permissionCatalogue, setPermissionCatalogue] = useState<PermissionCatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Role permission editing state
  const [displayName, setDisplayName] = useState(fallbackLabel);
  const [description, setDescription] = useState('');
  const [staffType, setStaffType] = useState<StaffType>(inferStaffTypeFromRole(canonicalKey));
  const [checkedPerms, setCheckedPerms] = useState<Set<string>>(new Set());
  const [permSearch, setPermSearch] = useState('');
  const [savingRolePerms, setSavingRolePerms] = useState(false);

  // Add member to this role
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getAccountDirectory({ signal: controller.signal }),
      getRolesWithPermissions({ signal: controller.signal }),
      getPermissionCatalogue({ signal: controller.signal }),
    ])
      .then(([accountsData, rolesData, permsData]) => {
        if (!active) return;
        setRows(accountsData);
        setRolesCatalogue(rolesData);
        setPermissionCatalogue(permsData);

        const match = rolesData.find((r) => roleKey(r.role_key) === canonicalKey);
        if (match) {
          setDisplayName(match.display_name);
          setDescription(match.description);
          setStaffType(match.staff_type);
          setCheckedPerms(new Set(match.permission_codes));
        } else {
          setDisplayName(fallbackLabel);
          setStaffType(inferStaffTypeFromRole(canonicalKey));
          setCheckedPerms(new Set());
        }
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load role details');
        setError(describeAnalyticsError(caught, 'Could not load role details.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [canonicalKey, fallbackLabel, reloadToken]);

  const refresh = useCallback(() => {
    setActionError(null);
    setActionSuccess(null);
    setReloadToken((value) => value + 1);
  }, []);

  const summary = useMemo(
    () => findRoleSummary(rows, canonicalKey, rolesCatalogue),
    [rows, canonicalKey, rolesCatalogue]
  );
  const members = useMemo(
    () => filterAccounts(rows, { role: canonicalKey }),
    [rows, canonicalKey]
  );

  const handleTogglePerms = (codes: string[], nextChecked: boolean) => {
    setCheckedPerms((prev) => {
      const next = new Set(prev);
      for (const code of codes) {
        if (nextChecked) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  };

  const handleSaveRolePermissions = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingRolePerms(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertCustomRole({
        roleKey: canonicalKey,
        displayName: displayName || fallbackLabel,
        description,
        staffType,
        permissionCodes: Array.from(checkedPerms),
      });
      setActionSuccess('Saved role details and permission assignments.');
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save role permissions.'));
    } finally {
      setSavingRolePerms(false);
    }
  };

  const handleAddMember = async (event: React.FormEvent) => {
    event.preventDefault();
    setAddingMember(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await inviteOrCreateAccount({
        fullName: memberName,
        email: memberEmail,
        role: canonicalKey,
        staffType,
      });
      setMemberName('');
      setMemberEmail('');
      setShowAddMember(false);
      setActionSuccess(`Added member to ${summary?.label ?? fallbackLabel}.`);
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not add member.'));
    } finally {
      setAddingMember(false);
    }
  };

  const handleSaveAccount = async (payload: AccountRowSavePayload) => {
    setBusyAccountId(payload.userId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await updateAccountProfile(payload);
      setActionSuccess('Updated member profile.');
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not update member.'));
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleToggleRevokeAccess = async (row: AccountDirectoryRow) => {
    setBusyAccountId(row.account_id);
    setActionError(null);
    setActionSuccess(null);
    const nextRevoked = !row.access_revoked;
    try {
      await setUserAccessRevoked(row.account_id, nextRevoked);
      setActionSuccess(
        nextRevoked
          ? `Revoked all access for ${row.full_name || row.email || 'member'}.`
          : `Restored access for ${row.full_name || row.email || 'member'}.`
      );
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not update member access.'));
    } finally {
      setBusyAccountId(null);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">
              Analytics
            </Link>{' '}
            /{' '}
            <Link href="/analytics/accounts" className="text-blue-700 hover:underline">
              Accounts &amp; roles
            </Link>{' '}
            / {summary?.label ?? fallbackLabel}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {summary?.label ?? fallbackLabel}
            </h1>
            {summary?.scope && (
              <Badge
                className={
                  summary.scope === 'GLOBAL'
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }
              >
                {summary.scope === 'GLOBAL' ? 'Global role' : 'Custom role'}
              </Badge>
            )}
            <Badge className="border-gray-200 bg-gray-50 text-gray-700">
              {staffTypeLabel(summary?.staffType ?? staffType)}
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {summary?.description || `Members and permissions for the ${canonicalKey} role.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              setShowAddMember((v) => !v);
              setActiveTab('members');
            }}
          >
            {showAddMember ? 'Close form' : '+ Add member'}
          </Button>
          <Link
            href="/analytics/accounts"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            All roles
          </Link>
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Zeraki RoleDetailsComponent tabs: Members (N) | Permissions */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'members'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Members ({members.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('permissions')}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'permissions'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Permissions ({checkedPerms.size})
        </button>
      </div>

      {actionError && (
        <div className="mb-4">
          <Alert tone="error" title="Action failed">
            {actionError}
          </Alert>
        </div>
      )}

      {actionSuccess && (
        <div className="mb-4">
          <Alert tone="success" title="Saved">
            {actionSuccess}
          </Alert>
        </div>
      )}

      {loading ? (
        <LoadingPanel label="Loading role details…" />
      ) : error ? (
        <Alert
          tone="error"
          title="Could not load role details"
          action={
            <Button variant="danger" size="sm" onClick={refresh}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : activeTab === 'permissions' ? (
        <Card>
          <CardHeader
            title={`Modify permissions for ${summary?.label ?? fallbackLabel}`}
            description="Changes apply to all members of this role unless overridden on an individual user."
          />
          <form onSubmit={handleSaveRolePermissions} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                id="role-display-name"
                label="Display name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <SelectField
                id="role-staff-type"
                label="Staff type"
                value={staffType}
                onChange={(e) => setStaffType(e.target.value as StaffType)}
              >
                {STAFF_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SelectField>
              <TextField
                id="role-description"
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-xs text-gray-600">
                {checkedPerms.size} of {permissionCatalogue.length} permissions enabled for this
                role.
              </p>
              <div className="w-full sm:w-64">
                <TextField
                  id="role-perm-search"
                  label="Search permissions"
                  type="search"
                  placeholder="Filter by name or code…"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                />
              </div>
            </div>

            <PermissionCategoryChecklist
              catalogue={permissionCatalogue}
              checkedCodes={checkedPerms}
              onToggleCodes={handleTogglePerms}
              searchQuery={permSearch}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={savingRolePerms}>
                {savingRolePerms ? 'Saving…' : 'Save role & permissions'}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="space-y-6">
          {showAddMember && (
            <Card>
              <CardHeader
                title={`Add member to ${summary?.label ?? fallbackLabel}`}
                description="Creates a new account assigned directly to this role"
              />
              <form onSubmit={handleAddMember} className="flex flex-wrap items-end gap-3 p-5">
                <TextField
                  id="add-member-name"
                  label="Full name"
                  required
                  placeholder="Full name"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                />
                <TextField
                  id="add-member-email"
                  label="Email"
                  type="email"
                  required
                  placeholder="staff@school.local"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                />
                <Button type="submit" disabled={addingMember}>
                  {addingMember ? 'Adding…' : 'Add member'}
                </Button>
              </form>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard label="Members" value={members.length} />
            <StatCard
              label="Active"
              value={members.filter((m) => m.is_active && !m.access_revoked).length}
            />
            <StatCard label="Inactive" value={members.filter((m) => !m.is_active).length} />
            <StatCard label="Role permissions" value={checkedPerms.size} />
          </div>

          <AccountDirectoryTable
            rows={members}
            totalCount={members.length}
            title={`${summary?.label ?? fallbackLabel} members`}
            description={`${members.length} ${
              members.length === 1 ? 'account' : 'accounts'
            } assigned to this role. Use Permissions to configure per-user overrides.`}
            roleOptions={rolesCatalogue.map((r) => r.role_key)}
            onSaveAccount={handleSaveAccount}
            onToggleRevokeAccess={handleToggleRevokeAccess}
            busyAccountId={busyAccountId}
          />
        </div>
      )}
    </main>
  );
}
