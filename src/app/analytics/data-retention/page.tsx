'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getDataRetentionPolicies,
  isAbortError,
  upsertDataRetentionPolicy,
} from '@/lib/analytics/api';
import type { DataRetentionPolicy } from '@/lib/analytics/types';

export default function DataRetentionPage() {
  const [policies, setPolicies] = useState<DataRetentionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formEntity, setFormEntity] = useState('');
  const [formDays, setFormDays] = useState('365');
  const [formAction, setFormAction] = useState('archive');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    getDataRetentionPolicies({ signal: controller.signal })
      .then((data) => { if (!active) return; setPolicies(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load policies.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEntity.trim() || !formDays) { setActionError('Entity type and days required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertDataRetentionPolicy(formEntity.trim(), Number(formDays), formAction);
      setActionSuccess('Policy saved.');
      setShowForm(false);
      setFormEntity(''); setFormDays('365');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save policy.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading data retention…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load data retention">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Data Retention
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Data Retention Policies</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Configure data retention and archival policies per entity type.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Policy'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Add Retention Policy" />
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="dr-entity" label="Entity Type" required placeholder="e.g. audit_events" value={formEntity} onChange={(e) => setFormEntity(e.target.value)} />
              <TextField id="dr-days" label="Retention Days" type="number" required value={formDays} onChange={(e) => setFormDays(e.target.value)} />
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Action</label>
                <select value={formAction} onChange={(e) => setFormAction(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="archive">Archive</option>
                  <option value="anonymize">Anonymize</option>
                  <option value="delete">Delete</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Policy'}</Button>
            </div>
          </form>
        </Card>
      )}

      {policies.length === 0 ? (
        <EmptyState title="No retention policies" description="Create your first policy above." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Entity Type</th>
                  <th scope="col" className="px-4 py-3">Retention Days</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                  <th scope="col" className="px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {policies.map((p) => (
                  <tr key={p.policy_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{p.entity_type}</td>
                    <td className="px-4 py-2.5 text-gray-700">{p.retention_days}</td>
                    <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{p.action}</Badge></td>
                    <td className="px-4 py-2.5">
                      <Badge className={p.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </main>
  );
}
