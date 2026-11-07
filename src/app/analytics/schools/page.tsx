'use client';

import { useEffect, useState } from 'react';
import { Building2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Modal, RadioCardGroup } from '@/components/overlays';
import { Alert, Button, Card, EmptyState, TextField } from '@/components/ui';
import { getMyPermissions } from '@/lib/analytics/api';
import { roleKey } from '@/lib/analytics/accounts';
import { apiErrorMessage } from '@/lib/analytics/errors';
import { createClient } from '@/lib/supabase/client';

type Setup = 'invite' | 'password';
interface Created {
  schoolName: string;
  ownerEmail: string;
  invited: boolean;
}

interface School {
  id: string;
  name: string;
  created_at: string;
  owner_email: string | null;
  owner_name: string | null;
  subscription_status: string | null;
  subscription_expires_at: string | null;
}

export default function SchoolsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [setup, setSetup] = useState<Setup>('invite');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [subTarget, setSubTarget] = useState<School | null>(null);
  const [subStatus, setSubStatus] = useState('active');
  const [subExpiry, setSubExpiry] = useState('');
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const loadSchools = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc('get_schools');
      if (rpcError) throw new Error(rpcError.message);
      setSchools((data ?? []) as School[]);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : 'Could not load schools.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    getMyPermissions({ signal: controller.signal })
      .then((me) => {
        const isSuper = roleKey(me.role) === 'super admin';
        setAllowed(isSuper);
        if (isSuper) loadSchools();
      })
      .catch(() => setAllowed(false));
    return () => controller.abort();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session expired. Sign in again.');
      const res = await fetch('/api/schools', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: deleteTarget.id }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(apiErrorMessage(payload, 'Could not delete the school.'));
      setDeleteTarget(null);
      loadSchools();
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : 'Could not delete the school.');
    } finally {
      setDeleting(false);
    }
  };

  const openSubscription = (school: School) => {
    setSubError(null);
    setSubTarget(school);
    setSubStatus(school.subscription_status ?? 'active');
    setSubExpiry(school.subscription_expires_at ? school.subscription_expires_at.slice(0, 10) : '');
  };

  const handleSubscription = async () => {
    if (!subTarget) return;
    setSubSaving(true);
    setSubError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc('update_school_subscription', {
        p_tenant_id: subTarget.id,
        p_status: subStatus,
        p_expires_at: subExpiry ? new Date(subExpiry).toISOString() : null,
      });
      if (rpcError) throw new Error(rpcError.message);
      setSubTarget(null);
      loadSchools();
    } catch (caught) {
      setSubError(caught instanceof Error ? caught.message : 'Could not update subscription.');
    } finally {
      setSubSaving(false);
    }
  };

  const handleCancelSubscription = async (school: School) => {
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('update_school_subscription', {
      p_tenant_id: school.id,
      p_status: 'suspended',
      p_expires_at: school.subscription_expires_at,
    });
    if (rpcError) {
      setLoadError(rpcError.message);
      return;
    }
    loadSchools();
  };

  const reset = () => {
    setSchoolName('');
    setOwnerName('');
    setOwnerEmail('');
    setPassword('');
    setSetup('invite');
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session expired. Sign in again.');
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          schoolName,
          ownerName,
          ownerEmail,
          password: setup === 'password' ? password : undefined,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        invited?: boolean;
        ownerEmail?: string;
      };
      if (!res.ok) throw new Error(apiErrorMessage(payload, 'Could not add the school.'));
      setCreated((list) => [
        { schoolName, ownerEmail: payload.ownerEmail ?? ownerEmail, invited: Boolean(payload.invited) },
        ...list,
      ]);
      setOpen(false);
      reset();
      loadSchools();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the school.');
    } finally {
      setSaving(false);
    }
  };

  if (allowed === null) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Schools</h1>
          <p className="mt-1 max-w-xl text-sm text-gray-600">
            Add and manage school tenants. Each school only sees its own data.
          </p>
        </div>
        {allowed && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadSchools} disabled={loading}>
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add school
            </Button>
          </div>
        )}
      </div>

      {!allowed ? (
        <Alert tone="warning" title="Platform super admins only">
          Your account cannot manage schools. Ask a platform super admin.
        </Alert>
      ) : (
        <>
          {created.map((c) => (
            <div key={c.ownerEmail + c.schoolName} className="mb-3">
              <Alert tone="success" title={`${c.schoolName} added`}>
                {c.invited
                  ? `An invitation was emailed to ${c.ownerEmail}. They set a password from the link, then sign in.`
                  : `${c.ownerEmail} can sign in now with the password you set.`}
              </Alert>
            </div>
          ))}

          {loadError && (
            <Alert tone="error" title="Could not load schools">
              {loadError}
            </Alert>
          )}

          {schools.length === 0 && !loading ? (
            <Card>
              <EmptyState
                title="No schools yet"
                action={
                  <Button variant="secondary" onClick={() => setOpen(true)}>
                    <Building2 aria-hidden="true" className="h-4 w-4" />
                    Add school
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">School</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Expires</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map((s) => (
                      <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                        <td className="px-4 py-3 text-gray-700">{s.owner_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{s.owner_email ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            {s.subscription_status ?? 'active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {s.subscription_expires_at ? new Date(s.subscription_expires_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => openSubscription(s)}>
                              {s.subscription_status === 'suspended' ? 'Reactivate' : 'Manage sub'}
                            </Button>
                            {s.subscription_status !== 'suspended' && (
                              <Button variant="secondary" onClick={() => handleCancelSubscription(s)} className="text-amber-700 hover:bg-amber-50">
                                Cancel sub
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteTarget(s);
                              }}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      <Modal
        open={open}
        onClose={() => {
          if (!saving) {
            setOpen(false);
            reset();
          }
        }}
        title="Add a school"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="school-form" disabled={saving}>
              {saving ? 'Adding…' : 'Add school'}
            </Button>
          </>
        }
      >
        <form id="school-form" onSubmit={submit} className="space-y-4">
          {error && (
            <Alert tone="error" title="Could not add the school">
              {error}
            </Alert>
          )}
          <TextField id="school-name" label="School name" required value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
          <TextField id="owner-name" label="Owner full name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          <TextField id="owner-email" label="Owner email" type="email" required value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
          <RadioCardGroup
            legend="How the owner gets access"
            name="school-setup"
            value={setup}
            onChange={setSetup}
            columns={1}
            options={[
              { value: 'invite', label: 'Email an invitation', description: 'They choose their own password from the link.' },
              { value: 'password', label: 'Set a password now', description: 'You give them the password. Use at least 8 characters.' },
            ]}
          />
          {setup === 'password' && (
            <TextField id="owner-password" label="Initial password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </form>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        title="Delete school"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={deleting}
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={deleting}
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        {deleteError && (
          <Alert tone="error" title="Could not delete the school">
            {deleteError}
          </Alert>
        )}
        <p className="text-sm text-gray-700">
          Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
      </Modal>

      <Modal
        open={subTarget !== null}
        onClose={() => {
          if (!subSaving) {
            setSubTarget(null);
            setSubError(null);
          }
        }}
          title="Manage subscription"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={subSaving}
              onClick={() => {
                setSubTarget(null);
                setSubError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="sub-form" disabled={subSaving}>
              {subSaving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form id="sub-form" onSubmit={(e) => { e.preventDefault(); handleSubscription(); }} className="space-y-4">
          {subError && (
            <Alert tone="error" title="Could not update subscription">
              {subError}
            </Alert>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
            <select
              value={subStatus}
              onChange={(e) => setSubStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <TextField
            id="sub-expiry"
            label="Expires on (optional)"
            type="date"
            value={subExpiry}
            onChange={(e) => setSubExpiry(e.target.value)}
          />
        </form>
      </Modal>
    </main>
  );
}
