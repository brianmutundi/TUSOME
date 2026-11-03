'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PermissionCategoryChecklist } from '@/components/analytics/AccountDirectoryTable';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  LoadingPanel,
  TextField,
} from '@/components/ui';
import {
  accountDisplayName,
  buildUserPermissionOverrides,
  computeUserPermissionTabSets,
  roleKey,
  roleLabel,
  staffTypeLabel,
  type UserPermissionsTab,
} from '@/lib/analytics/accounts';
import {
  describeAnalyticsError,
  getPermissionCatalogue,
  getUserPermissionProfile,
  isAbortError,
  saveUserPermissionOverrides,
  setUserAccessRevoked,
} from '@/lib/analytics/api';
import { isUuid } from '@/lib/analytics/guards';
import type {
  PermissionCatalogueItem,
  UserPermissionProfile,
} from '@/lib/analytics/types';

function decodeParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const TAB_HINTS: Record<UserPermissionsTab, string> = {
  granted:
    'Permissions currently active for this user (inherited from their role or granted specifically). Uncheck a permission to restrict it.',
  eligible:
    'Permissions not currently granted to this user. Check any permission below to grant it as a user-specific override.',
  restricted:
    'Permissions explicitly denied for this user. Uncheck a permission to lift the restriction.',
};

export default function UserPermissionsPage() {
  const params = useParams<{ role?: string | string[]; userId?: string | string[] }>();
  const requestedRole = decodeParam(params?.role);
  const userId = decodeParam(params?.userId);
  const validUserId = isUuid(userId);

  const [catalogue, setCatalogue] = useState<PermissionCatalogueItem[]>([]);
  const [profile, setProfile] = useState<UserPermissionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [activeTab, setActiveTab] = useState<UserPermissionsTab>('granted');
  const [searchQuery, setSearchQuery] = useState('');
  const [toGrant, setToGrant] = useState<Set<string>>(new Set());
  const [toRemove, setToRemove] = useState<Set<string>>(new Set());
  const [toUnrestrict, setToUnrestrict] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [togglingRevoke, setTogglingRevoke] = useState(false);

  useEffect(() => {
    if (!validUserId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getPermissionCatalogue({ signal: controller.signal }),
      getUserPermissionProfile(userId, { signal: controller.signal }),
    ])
      .then(([catalogueData, profileData]) => {
        if (!active) return;
        setCatalogue(catalogueData);
        setProfile(profileData);
        setToGrant(new Set());
        setToRemove(new Set());
        setToUnrestrict(new Set());
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load user permissions');
        setError(describeAnalyticsError(caught, 'Could not load user permissions.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [userId, validUserId, reloadToken]);

  const refresh = useCallback(() => {
    setActionError(null);
    setActionSuccess(null);
    setReloadToken((v) => v + 1);
  }, []);

  const tabSets = useMemo(() => {
    if (!profile) {
      return {
        granted: new Set<string>(),
        eligible: new Set<string>(),
        restricted: new Set<string>(),
      };
    }
    return computeUserPermissionTabSets(catalogue, profile);
  }, [catalogue, profile]);

  const visibleCatalogue = useMemo(() => {
    const allowed = tabSets[activeTab];
    return catalogue.filter((item) => allowed.has(item.code));
  }, [catalogue, tabSets, activeTab]);

  const checkedCodes = useMemo(() => {
    if (activeTab === 'granted') {
      return new Set(
        Array.from(tabSets.granted).filter((code) => !toRemove.has(code))
      );
    }
    if (activeTab === 'eligible') {
      return toGrant;
    }
    return new Set(
      Array.from(tabSets.restricted).filter((code) => !toUnrestrict.has(code))
    );
  }, [activeTab, tabSets, toGrant, toRemove, toUnrestrict]);

  const pendingCount = toGrant.size + toRemove.size + toUnrestrict.size;

  const handleToggleCodes = (codes: string[], nextChecked: boolean) => {
    if (activeTab === 'granted') {
      setToRemove((prev) => {
        const next = new Set(prev);
        for (const code of codes) {
          if (!nextChecked) next.add(code);
          else next.delete(code);
        }
        return next;
      });
    } else if (activeTab === 'eligible') {
      setToGrant((prev) => {
        const next = new Set(prev);
        for (const code of codes) {
          if (nextChecked) next.add(code);
          else next.delete(code);
        }
        return next;
      });
    } else {
      setToUnrestrict((prev) => {
        const next = new Set(prev);
        for (const code of codes) {
          if (!nextChecked) next.add(code);
          else next.delete(code);
        }
        return next;
      });
    }
  };

  const discardPending = () => {
    setToGrant(new Set());
    setToRemove(new Set());
    setToUnrestrict(new Set());
  };

  const handleSaveOverrides = async () => {
    if (!profile || pendingCount === 0) return;
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const overrides = buildUserPermissionOverrides({
        rolePermissions: profile.role_permissions,
        grantedOverrides: profile.granted_overrides,
        toGrant,
        toRemove,
        toUnrestrict,
      });
      const updated = await saveUserPermissionOverrides({
        userId: profile.account_id,
        ...overrides,
      });
      setProfile(updated);
      discardPending();
      setActionSuccess('User permission overrides updated.');
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save user permissions.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRevokeAll = async () => {
    if (!profile) return;
    setTogglingRevoke(true);
    setActionError(null);
    setActionSuccess(null);
    const nextRevoked = !profile.access_revoked;
    try {
      await setUserAccessRevoked(profile.account_id, nextRevoked);
      setActionSuccess(
        nextRevoked
          ? 'All access revoked for this account.'
          : 'Access restored to role and override permissions.'
      );
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not change access status.'));
    } finally {
      setTogglingRevoke(false);
    }
  };

  const canonicalRole = roleKey(profile?.role ?? requestedRole);
  const displayRole = roleLabel(profile?.role ?? requestedRole);

  if (!validUserId) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Invalid account link">
          The account identifier in this URL is not a valid UUID.
        </Alert>
      </main>
    );
  }

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
            /{' '}
            <Link
              href={`/analytics/accounts/${encodeURIComponent(canonicalRole)}`}
              className="text-blue-700 hover:underline"
            >
              {displayRole}
            </Link>{' '}
            / User permissions
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            {profile ? accountDisplayName(profile) : 'User Permissions'}
          </h1>
          {profile && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span>{profile.email || 'No email'}</span>
              <span>·</span>
              <Badge className="border-blue-200 bg-blue-50 text-blue-800">{displayRole}</Badge>
              <Badge className="border-gray-200 bg-gray-50 text-gray-700">
                {staffTypeLabel(profile.staff_type)}
              </Badge>
              {profile.access_revoked && (
                <Badge className="border-red-200 bg-red-50 text-red-800">No Access</Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {profile && (
            <Button
              variant={profile.access_revoked ? 'primary' : 'danger'}
              disabled={togglingRevoke}
              onClick={handleToggleRevokeAll}
            >
              {togglingRevoke
                ? 'Updating…'
                : profile.access_revoked
                  ? 'Restore Access'
                  : 'Revoke All Access'}
            </Button>
          )}
          <Link
            href={`/analytics/accounts/${encodeURIComponent(canonicalRole)}`}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Back to role
          </Link>
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
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
        <LoadingPanel label="Loading user permissions…" />
      ) : error || !profile ? (
        <Alert
          tone="error"
          title="Could not load user permissions"
          action={
            <Button variant="danger" size="sm" onClick={refresh}>
              Retry
            </Button>
          }
        >
          {error ?? 'Account not found.'}
        </Alert>
      ) : profile.access_revoked ? (
        <Card>
          <CardHeader
            title="Access revoked for this user"
            action={
              <Button
                variant="primary"
                disabled={togglingRevoke}
                onClick={handleToggleRevokeAll}
              >
                {togglingRevoke ? 'Restoring…' : 'Restore Access'}
              </Button>
            }
          />
          <p className="p-5 text-sm text-gray-600">
            While access is revoked, this user holds zero effective permissions regardless of
            their role or individual overrides. Restore access to manage their Granted, Eligible,
            and Restricted permissions.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="border-b border-gray-200 px-5 pt-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['granted', `Granted (${tabSets.granted.size})`],
                    ['eligible', `Eligible (${tabSets.eligible.size})`],
                    ['restricted', `Restricted (${tabSets.restricted.size})`],
                  ] as const
                ).map(([tabKey, label]) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setActiveTab(tabKey)}
                    className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                      activeTab === tabKey
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="max-w-2xl text-xs text-gray-600">{TAB_HINTS[activeTab]}</p>
                <div className="w-full sm:w-64">
                  <TextField
                    id="user-perm-search"
                    label="Search permissions"
                    type="search"
                    placeholder="Filter permissions…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <PermissionCategoryChecklist
                catalogue={visibleCatalogue}
                checkedCodes={checkedCodes}
                onToggleCodes={handleToggleCodes}
                searchQuery={searchQuery}
                emptyMessage={`No ${activeTab} permissions match this view.`}
              />

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-4">
                {pendingCount > 0 && (
                  <>
                    <span className="text-xs font-medium text-amber-800">
                      {pendingCount} pending {pendingCount === 1 ? 'change' : 'changes'}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={submitting}
                      onClick={discardPending}
                    >
                      Discard
                    </Button>
                  </>
                )}
                <Button
                  variant="primary"
                  disabled={pendingCount === 0 || submitting}
                  onClick={handleSaveOverrides}
                >
                  {submitting ? 'Updating…' : 'Update permissions'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
