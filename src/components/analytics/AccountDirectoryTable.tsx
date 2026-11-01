'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardHeader, EmptyState } from '@/components/ui';
import {
  accountDisplayName,
  formatAccountDate,
  groupPermissionsByCategory,
  inferStaffTypeFromRole,
  roleKey,
  roleLabel,
  STAFF_TYPE_OPTIONS,
  staffTypeLabel,
  type RoleSummary,
} from '@/lib/analytics/accounts';
import type {
  AccountDirectoryRow,
  PermissionCatalogueItem,
  StaffType,
} from '@/lib/analytics/types';

export function RoleSummaryGrid({
  roles,
  selectedRole,
  onSelectRole,
  onDeleteRole,
  busyRoleKey,
}: {
  roles: RoleSummary[];
  selectedRole?: string;
  onSelectRole?: (roleKey: string) => void;
  onDeleteRole?: (roleKey: string) => void;
  busyRoleKey?: string | null;
}) {
  if (roles.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {roles.map((role) => {
        const activeFilter = selectedRole === role.key;
        const canDelete =
          onDeleteRole && role.scope === 'CUSTOM' && role.total === 0 && role.key !== 'unassigned';
        return (
          <div
            key={role.key}
            className={`flex flex-col justify-between rounded-xl border bg-white p-4 shadow-sm transition-colors ${
              activeFilter ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-200'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/analytics/accounts/${encodeURIComponent(role.key)}`}
                    className="text-sm font-semibold text-blue-800 hover:text-blue-950 hover:underline"
                  >
                    {role.label}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {role.scope && (
                      <Badge
                        className={
                          role.scope === 'GLOBAL'
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                        }
                      >
                        {role.scope === 'GLOBAL' ? 'Global' : 'Custom'}
                      </Badge>
                    )}
                    {role.staffType && (
                      <Badge className="border-gray-200 bg-gray-50 text-gray-700">
                        {staffTypeLabel(role.staffType)}
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="text-lg font-bold text-gray-900">{role.total}</span>
              </div>
              {role.description && (
                <p className="mt-2 line-clamp-2 text-xs text-gray-600">{role.description}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                {role.active} active · {role.inactive} inactive
                {typeof role.permissionCount === 'number'
                  ? ` · ${role.permissionCount} permissions`
                  : ''}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5 text-xs">
              <Link
                href={`/analytics/accounts/${encodeURIComponent(role.key)}`}
                className="font-medium text-blue-700 hover:text-blue-900"
              >
                Members &amp; permissions
              </Link>
              <div className="flex items-center gap-3">
                {onSelectRole && (
                  <button
                    type="button"
                    onClick={() => onSelectRole(activeFilter ? 'all' : role.key)}
                    className="font-medium text-gray-600 hover:text-gray-900"
                  >
                    {activeFilter ? 'Clear filter' : 'Filter table'}
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    disabled={busyRoleKey === role.key}
                    onClick={() => onDeleteRole(role.key)}
                    className="font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface AccountRowSavePayload {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  staffType: StaffType;
  isActive: boolean;
}

export function AccountDirectoryTable({
  rows,
  totalCount,
  title = 'School accounts',
  description,
  roleOptions = [],
  onSaveAccount,
  onToggleRevokeAccess,
  busyAccountId,
}: {
  rows: AccountDirectoryRow[];
  totalCount: number;
  title?: string;
  description?: string;
  roleOptions?: string[];
  onSaveAccount?: (payload: AccountRowSavePayload) => Promise<void> | void;
  onToggleRevokeAccess?: (row: AccountDirectoryRow) => Promise<void> | void;
  busyAccountId?: string | null;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftRole, setDraftRole] = useState('');
  const [draftStaffType, setDraftStaffType] = useState<StaffType>('OFFICIAL');
  const [draftActive, setDraftActive] = useState(true);

  const startEdit = (row: AccountDirectoryRow) => {
    setEditingId(row.account_id);
    setDraftName(row.full_name ?? '');
    setDraftEmail(row.email ?? '');
    setDraftRole(row.role ?? 'teacher');
    setDraftStaffType(row.staff_type ?? inferStaffTypeFromRole(row.role));
    setDraftActive(row.is_active);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const submitEdit = async (userId: string) => {
    if (!onSaveAccount) return;
    await onSaveAccount({
      userId,
      fullName: draftName,
      email: draftEmail,
      role: draftRole,
      staffType: draftStaffType,
      isActive: draftActive,
    });
    setEditingId(null);
  };

  const defaultDescription =
    rows.length === totalCount
      ? `${rows.length} ${rows.length === 1 ? 'account' : 'accounts'} in your school`
      : `Showing ${rows.length} of ${totalCount} accounts`;

  const showActions = Boolean(onSaveAccount || onToggleRevokeAccess);

  return (
    <Card>
      <CardHeader title={title} description={description ?? defaultDescription} />
      {rows.length === 0 ? (
        <EmptyState
          title={totalCount === 0 ? 'No accounts found' : 'No accounts match these filters'}
          description={
            totalCount === 0
              ? 'No profile rows were returned for your school.'
              : 'Clear the search or role/status filter to see all accounts.'
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Name &amp; Email
                </th>
                <th scope="col" className="px-4 py-3">
                  Role
                </th>
                <th scope="col" className="px-4 py-3">
                  Staff Type
                </th>
                <th scope="col" className="px-4 py-3">
                  Status &amp; Overrides
                </th>
                <th scope="col" className="px-4 py-3">
                  Created
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  {showActions ? 'Actions' : 'Permissions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.map((row) => {
                const key = roleKey(row.role);
                const label = roleLabel(row.role);
                const resolvedStaffType = row.staff_type ?? inferStaffTypeFromRole(row.role);
                const unnamed = !(row.full_name ?? '').trim();
                const isEditing = editingId === row.account_id;
                const isBusy = busyAccountId === row.account_id;
                const grantedCount = row.granted_overrides ?? 0;
                const deniedCount = row.denied_overrides ?? 0;

                if (isEditing) {
                  return (
                    <tr key={row.account_id} className="bg-blue-50/40">
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            aria-label="Full name"
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            placeholder="Full name"
                            className="w-full rounded border border-gray-300 px-2.5 py-1 text-sm"
                          />
                          <input
                            type="email"
                            aria-label="Email"
                            value={draftEmail}
                            onChange={(e) => setDraftEmail(e.target.value)}
                            placeholder="email@school.local"
                            className="w-full rounded border border-gray-300 px-2.5 py-1 text-xs"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          list={`role-options-${row.account_id}`}
                          aria-label="Role"
                          value={draftRole}
                          onChange={(e) => setDraftRole(e.target.value)}
                          className="w-full rounded border border-gray-300 px-2.5 py-1 text-sm"
                        />
                        {roleOptions.length > 0 && (
                          <datalist id={`role-options-${row.account_id}`}>
                            {roleOptions.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label="Staff type"
                          value={draftStaffType}
                          onChange={(e) => setDraftStaffType(e.target.value as StaffType)}
                          className="rounded border border-gray-300 bg-white px-2.5 py-1 text-sm"
                        >
                          {STAFF_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-800">
                          <input
                            type="checkbox"
                            checked={draftActive}
                            onChange={(e) => setDraftActive(e.target.checked)}
                          />
                          Active account
                        </label>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatAccountDate(row.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={isBusy}
                            onClick={() => submitEdit(row.account_id)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={row.account_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        <span className={unnamed ? 'italic text-gray-500' : ''}>
                          {accountDisplayName(row)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{row.email || 'No email set'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/analytics/accounts/${encodeURIComponent(key)}`}
                        className="inline-block"
                      >
                        <Badge className="border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100">
                          {label}
                        </Badge>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {staffTypeLabel(resolvedStaffType)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.is_active ? (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="border-gray-300 bg-gray-100 text-gray-700">
                            Inactive
                          </Badge>
                        )}
                        {row.access_revoked && (
                          <Badge className="border-red-200 bg-red-50 text-red-800">
                            No Access
                          </Badge>
                        )}
                        {(grantedCount > 0 || deniedCount > 0) && (
                          <Badge
                            title="Per-user permission overrides"
                            className="border-purple-200 bg-purple-50 text-purple-800"
                          >
                            +{grantedCount} / -{deniedCount}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatAccountDate(row.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-2 text-xs">
                        <Link
                          href={`/analytics/accounts/${encodeURIComponent(key)}/user/${encodeURIComponent(row.account_id)}`}
                          className="font-medium text-blue-700 hover:text-blue-900"
                        >
                          Permissions
                        </Link>
                        {onSaveAccount && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => startEdit(row)}
                            className="font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
                          >
                            Edit
                          </button>
                        )}
                        {onToggleRevokeAccess && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onToggleRevokeAccess(row)}
                            className={`font-medium disabled:opacity-50 ${
                              row.access_revoked
                                ? 'text-emerald-700 hover:text-emerald-900'
                                : 'text-red-600 hover:text-red-800'
                            }`}
                          >
                            {row.access_revoked ? 'Restore access' : 'Revoke access'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function PermissionCategoryChecklist({
  catalogue,
  checkedCodes,
  onToggleCodes,
  searchQuery = '',
  emptyMessage = 'No permissions in this view.',
}: {
  catalogue: PermissionCatalogueItem[];
  checkedCodes: Set<string>;
  onToggleCodes: (codes: string[], nextChecked: boolean) => void;
  searchQuery?: string;
  emptyMessage?: string;
}) {
  const groups = groupPermissionsByCategory(catalogue, searchQuery);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
      {groups.map((group) => {
        const codes = group.permissions.map((p) => p.code);
        const selectedCount = codes.filter((code) => checkedCodes.has(code)).length;
        const allSelected = codes.length > 0 && selectedCount === codes.length;

        return (
          <div key={group.category_code} className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onToggleCodes(codes, e.target.checked)}
                />
                <span>{group.category_name}</span>
              </label>
              <span className="text-xs text-gray-500">
                {selectedCount} of {codes.length} selected
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.permissions.map((perm) => (
                <label
                  key={perm.code}
                  className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-xs text-gray-800 hover:bg-gray-100/70"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checkedCodes.has(perm.code)}
                    onChange={(e) => onToggleCodes([perm.code], e.target.checked)}
                  />
                  <span>
                    <span className="block font-medium text-gray-900">{perm.display_name}</span>
                    <code className="text-[11px] text-gray-500">{perm.code}</code>
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
