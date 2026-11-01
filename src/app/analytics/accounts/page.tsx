'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AccountDirectoryTable,
  PermissionCategoryChecklist,
  RoleSummaryGrid,
  type AccountRowSavePayload,
} from '@/components/analytics/AccountDirectoryTable';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingPanel,
  SelectField,
  StatCard,
  TextField,
} from '@/components/ui';
import {
  computeAccountStats,
  filterAccounts,
  FORM_LEVEL_OPTIONS,
  formLevelLabel,
  inferStaffTypeFromRole,
  STAFF_TYPE_OPTIONS,
  staffTypeLabel,
  summarizeRoles,
  type AccountStatusFilter,
  type StaffTypeFilter,
} from '@/lib/analytics/accounts';
import {
  deleteCustomRole,
  deleteSectionHead,
  describeAnalyticsError,
  getAccountDirectory,
  getPermissionCatalogue,
  getRolesWithPermissions,
  getSectionHeads,
  inviteOrCreateAccount,
  isAbortError,
  setUserAccessRevoked,
  updateAccountProfile,
  upsertCustomRole,
  upsertSectionHead,
} from '@/lib/analytics/api';
import type {
  AccountDirectoryRow,
  PermissionCatalogueItem,
  RoleWithPermissionsRow,
  SectionHeadRow,
  StaffType,
} from '@/lib/analytics/types';

type TopSectionTab = 'directory' | 'section-heads';

export default function AccountsPage() {
  const [activeSection, setActiveSection] = useState<TopSectionTab>('directory');

  const [rows, setRows] = useState<AccountDirectoryRow[]>([]);
  const [rolesCatalogue, setRolesCatalogue] = useState<RoleWithPermissionsRow[]>([]);
  const [permissionCatalogue, setPermissionCatalogue] = useState<PermissionCatalogueItem[]>([]);
  const [sectionHeads, setSectionHeads] = useState<SectionHeadRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Filters
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [staffTypeFilter, setStaffTypeFilter] = useState<StaffTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<AccountStatusFilter>('all');

  // Invite / Create Account form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('teacher');
  const [inviteStaffType, setInviteStaffType] = useState<StaffType>('TEACHER');
  const [inviting, setInviting] = useState(false);

  // Create Custom Role form
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleStaffType, setNewRoleStaffType] = useState<StaffType>('OFFICIAL');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<Set<string>>(new Set());
  const [permSearch, setPermSearch] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  // Section head form
  const [selectedFormLevel, setSelectedFormLevel] = useState<string>('JUNIOR_SCHOOL');
  const [selectedHeadUserId, setSelectedHeadUserId] = useState<string>('');
  const [savingSectionHead, setSavingSectionHead] = useState(false);

  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [busyRoleKey, setBusyRoleKey] = useState<string | null>(null);
  const [busySectionHeadId, setBusySectionHeadId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getAccountDirectory({ signal: controller.signal }),
      getRolesWithPermissions({ signal: controller.signal }),
      getPermissionCatalogue({ signal: controller.signal }),
      getSectionHeads({ signal: controller.signal }),
    ])
      .then(([accountsData, rolesData, permsData, headsData]) => {
        if (!active) return;
        setRows(accountsData);
        setRolesCatalogue(rolesData);
        setPermissionCatalogue(permsData);
        setSectionHeads(headsData);
        if (!selectedHeadUserId && accountsData.length > 0) {
          setSelectedHeadUserId(accountsData[0].account_id);
        }
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load accounts & roles');
        setError(describeAnalyticsError(caught, 'Could not load school accounts and roles.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken, selectedHeadUserId]);

  const refresh = useCallback(() => {
    setActionError(null);
    setActionSuccess(null);
    setReloadToken((value) => value + 1);
  }, []);

  const roles = useMemo(
    () => summarizeRoles(rows, rolesCatalogue),
    [rows, rolesCatalogue]
  );
  const stats = useMemo(() => computeAccountStats(rows), [rows]);
  const filteredRows = useMemo(
    () =>
      filterAccounts(rows, {
        query,
        role: roleFilter,
        staffType: staffTypeFilter,
        status: statusFilter,
      }),
    [rows, query, roleFilter, staffTypeFilter, statusFilter]
  );

  const roleOptionKeys = useMemo(() => roles.map((r) => r.key), [roles]);

  useEffect(() => {
    if (roleFilter === 'all') return;
    if (roles.length > 0 && !roles.some((item) => item.key === roleFilter)) {
      setRoleFilter('all');
    }
  }, [roleFilter, roles]);

  const clearFilters = () => {
    setQuery('');
    setRoleFilter('all');
    setStaffTypeFilter('all');
    setStatusFilter('all');
  };

  const hasFilters =
    query.trim().length > 0 ||
    roleFilter !== 'all' ||
    staffTypeFilter !== 'all' ||
    statusFilter !== 'all';

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await inviteOrCreateAccount({
        fullName: inviteName,
        email: inviteEmail,
        role: inviteRole,
        staffType: inviteStaffType,
      });
      setInviteName('');
      setInviteEmail('');
      setShowInviteForm(false);
      setActionSuccess('Account created and added to your school directory.');
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create account.'));
    } finally {
      setInviting(false);
    }
  };

  const handleToggleNewRolePerms = (codes: string[], nextChecked: boolean) => {
    setNewRolePerms((prev) => {
      const next = new Set(prev);
      for (const code of codes) {
        if (nextChecked) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  };

  const handleCreateCustomRole = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingRole(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertCustomRole({
        displayName: newRoleName,
        description: newRoleDescription,
        staffType: newRoleStaffType,
        permissionCodes: Array.from(newRolePerms),
      });
      setNewRoleName('');
      setNewRoleDescription('');
      setNewRolePerms(new Set());
      setShowRoleForm(false);
      setActionSuccess('Custom role saved with its assigned permissions.');
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save custom role.'));
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (targetRoleKey: string) => {
    setBusyRoleKey(targetRoleKey);
    setActionError(null);
    setActionSuccess(null);
    try {
      await deleteCustomRole(targetRoleKey);
      setActionSuccess(`Deleted custom role "${targetRoleKey}".`);
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not delete custom role.'));
    } finally {
      setBusyRoleKey(null);
    }
  };

  const handleSaveAccount = async (payload: AccountRowSavePayload) => {
    setBusyAccountId(payload.userId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await updateAccountProfile(payload);
      setActionSuccess('Account profile updated.');
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not update account.'));
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
          ? `Revoked all access for ${row.full_name || row.email || 'account'}.`
          : `Restored access for ${row.full_name || row.email || 'account'}.`
      );
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not update access status.'));
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleSaveSectionHead = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedHeadUserId) return;
    setSavingSectionHead(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertSectionHead(selectedFormLevel, selectedHeadUserId);
      setActionSuccess(`Assigned section head for ${formLevelLabel(selectedFormLevel)}.`);
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save section head.'));
    } finally {
      setSavingSectionHead(false);
    }
  };

  const handleDeleteSectionHead = async (sectionHeadId: string) => {
    setBusySectionHeadId(sectionHeadId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await deleteSectionHead(sectionHeadId);
      setActionSuccess('Removed section head assignment.');
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not remove section head.'));
    } finally {
      setBusySectionHeadId(null);
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
            / Accounts, roles &amp; section heads
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            Accounts, Roles &amp; Permissions
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Manage school accounts, staff types, custom roles, permission catalogues, per-user
            permission overrides, and section heads.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setShowInviteForm((v) => !v);
              setShowRoleForm(false);
              setActiveSection('directory');
            }}
          >
            {showInviteForm ? 'Close account form' : '+ Invite / Add account'}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setShowRoleForm((v) => !v);
              setShowInviteForm(false);
              setActiveSection('directory');
            }}
          >
            {showRoleForm ? 'Close role form' : '+ Add custom role'}
          </Button>
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Section navigation tabs (User Roles & Accounts vs Section Heads) */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveSection('directory')}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeSection === 'directory'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Roles &amp; Accounts ({rows.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('section-heads')}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeSection === 'section-heads'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Section Heads ({sectionHeads.length})
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
        <LoadingPanel label="Loading school accounts and roles…" />
      ) : error ? (
        <Alert
          tone="error"
          title="Could not load accounts"
          action={
            <Button variant="danger" size="sm" onClick={refresh}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : activeSection === 'section-heads' ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Assign or update a section head"
              description="Assign a staff member to lead a school section / form level (Zeraki Section Heads parity)"
            />
            <form onSubmit={handleSaveSectionHead} className="flex flex-wrap items-end gap-3 p-5">
              <SelectField
                id="section-form-level"
                label="Form / Section Level"
                value={selectedFormLevel}
                onChange={(e) => setSelectedFormLevel(e.target.value)}
              >
                {FORM_LEVEL_OPTIONS.map((lvl) => (
                  <option key={lvl.value} value={lvl.value}>
                    {lvl.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="section-head-user"
                label="Staff Member"
                value={selectedHeadUserId}
                onChange={(e) => setSelectedHeadUserId(e.target.value)}
              >
                {rows.map((acct) => (
                  <option key={acct.account_id} value={acct.account_id}>
                    {acct.full_name || 'Unnamed'} ({acct.email || acct.role || 'staff'})
                  </option>
                ))}
              </SelectField>
              <Button type="submit" disabled={savingSectionHead || rows.length === 0}>
                {savingSectionHead ? 'Saving…' : 'Save section head'}
              </Button>
            </form>
          </Card>

          <Card>
            <CardHeader
              title="Current section heads"
              description={`${sectionHeads.length} section head ${
                sectionHeads.length === 1 ? 'assignment' : 'assignments'
              }`}
            />
            {sectionHeads.length === 0 ? (
              <EmptyState
                title="No section heads assigned yet"
                description="Choose a form level and staff member above to assign a section head."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-5 py-3">
                        Form / Section Level
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Teacher / Staff Member
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Email
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Staff Type
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {sectionHeads.map((sh) => (
                      <tr key={sh.section_head_id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-semibold text-gray-900">
                          {formLevelLabel(sh.form_level)}
                        </td>
                        <td className="px-5 py-3 text-gray-900">
                          {sh.user_full_name || 'Unnamed account'}
                        </td>
                        <td className="px-5 py-3 text-gray-600">{sh.user_email || '—'}</td>
                        <td className="px-5 py-3">
                          <Badge className="border-gray-200 bg-gray-50 text-gray-700">
                            {staffTypeLabel(sh.staff_type)}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-3 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFormLevel(sh.form_level);
                                setSelectedHeadUserId(sh.user_id);
                              }}
                              className="font-medium text-blue-700 hover:text-blue-900"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={busySectionHeadId === sh.section_head_id}
                              onClick={() => handleDeleteSectionHead(sh.section_head_id)}
                              className="font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {showInviteForm && (
            <Card>
              <CardHeader
                title="Invite or create a school account"
                description="Creates a tenant-scoped profile with email, role and Zeraki staff classification"
              />
              <form onSubmit={handleInviteSubmit} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <TextField
                  id="invite-name"
                  label="Full name"
                  required
                  placeholder="e.g. Jane Wambui"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
                <TextField
                  id="invite-email"
                  label="Email address"
                  type="email"
                  required
                  placeholder="jane@school.local"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <TextField
                  id="invite-role"
                  label="Role"
                  required
                  list="invite-role-datalist"
                  placeholder="e.g. teacher, principal, bursar"
                  value={inviteRole}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInviteRole(val);
                    setInviteStaffType(inferStaffTypeFromRole(val));
                  }}
                />
                <datalist id="invite-role-datalist">
                  {roleOptionKeys.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
                <SelectField
                  id="invite-staff-type"
                  label="Staff type"
                  value={inviteStaffType}
                  onChange={(e) => setInviteStaffType(e.target.value as StaffType)}
                >
                  {STAFF_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </SelectField>
                <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowInviteForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inviting}>
                    {inviting ? 'Creating…' : 'Create account'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {showRoleForm && (
            <Card>
              <CardHeader
                title="Add new custom role"
                description="Define a role name, staff type, description and select its permissions from the Zeraki permission catalogue"
              />
              <form onSubmit={handleCreateCustomRole} className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField
                    id="new-role-name"
                    label="Role name"
                    required
                    placeholder="e.g. Academic Dean, Bursar, HOD"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                  />
                  <SelectField
                    id="new-role-staff-type"
                    label="User / Staff type"
                    value={newRoleStaffType}
                    onChange={(e) => setNewRoleStaffType(e.target.value as StaffType)}
                  >
                    {STAFF_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    id="new-role-desc"
                    label="Description"
                    placeholder="Responsibilities for this role"
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                  />
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        Available permissions ({newRolePerms.size} selected)
                      </h3>
                      <p className="text-xs text-gray-500">
                        Check an entire category or individual permissions.
                      </p>
                    </div>
                    <div className="w-full sm:w-64">
                      <TextField
                        id="new-role-perm-search"
                        label="Filter permissions"
                        type="search"
                        placeholder="Search permissions…"
                        value={permSearch}
                        onChange={(e) => setPermSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <PermissionCategoryChecklist
                    catalogue={permissionCatalogue}
                    checkedCodes={newRolePerms}
                    onToggleCodes={handleToggleNewRolePerms}
                    searchQuery={permSearch}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowRoleForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={savingRole}>
                    {savingRole ? 'Saving role…' : 'Save custom role'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Total accounts" value={stats.total} />
            <StatCard label="Active" value={stats.active} />
            <StatCard label="Inactive" value={stats.inactive} />
            <StatCard label="Access revoked" value={stats.revoked} />
            <StatCard label="Roles configured" value={roles.length} />
          </div>

          {roles.length > 0 && (
            <section>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Roles</h2>
                  <p className="text-xs text-gray-500">
                    Global and custom school roles. Open any role to manage its members and
                    permission matrix.
                  </p>
                </div>
              </div>
              <RoleSummaryGrid
                roles={roles}
                selectedRole={roleFilter}
                onSelectRole={setRoleFilter}
                onDeleteRole={handleDeleteRole}
                busyRoleKey={busyRoleKey}
              />
            </section>
          )}

          <Card>
            <div className="flex flex-wrap items-end gap-3 p-4">
              <TextField
                id="account-search"
                label="Search"
                type="search"
                placeholder="Search by name, email or role…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <SelectField
                id="account-role"
                label="Role"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="all">All roles</option>
                {roles.map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.label} ({role.total})
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="account-staff-type"
                label="Staff type"
                value={staffTypeFilter}
                onChange={(event) =>
                  setStaffTypeFilter(event.target.value as StaffTypeFilter)
                }
              >
                <option value="all">All staff types</option>
                {STAFF_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="account-status"
                label="Status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as AccountStatusFilter)
                }
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
                <option value="revoked">Access revoked</option>
              </SelectField>
              {hasFilters && (
                <Button variant="ghost" size="md" onClick={clearFilters}>
                  Reset filters
                </Button>
              )}
            </div>
          </Card>

          <AccountDirectoryTable
            rows={filteredRows}
            totalCount={rows.length}
            roleOptions={roleOptionKeys}
            onSaveAccount={handleSaveAccount}
            onToggleRevokeAccess={handleToggleRevokeAccess}
            busyAccountId={busyAccountId}
          />
        </div>
      )}
    </main>
  );
}
