'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getStudentResidences,
  isAbortError,
  upsertStudentResidence,
} from '@/lib/analytics/api';
import type { StudentResidence } from '@/lib/analytics/types';

export default function ResidencesPage() {
  const [residences, setResidences] = useState<StudentResidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('Dormitory');
  const [formCapacity, setFormCapacity] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    getStudentResidences({ signal: controller.signal })
      .then((data) => { if (!active) return; setResidences(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load residences.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { setActionError('Name is required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertStudentResidence(formName.trim(), formType, formCapacity ? Number(formCapacity) : undefined);
      setActionSuccess('Residence saved.');
      setShowForm(false);
      setFormName(''); setFormType('Dormitory'); setFormCapacity('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save residence.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading residences…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load residences">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Residences
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Residences</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage student residences and dormitories.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Residence'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Add Residence" />
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="res-name" label="Name" required placeholder="e.g. Block A" value={formName} onChange={(e) => setFormName(e.target.value)} />
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="Dormitory">Dormitory</option>
                  <option value="Hostel">Hostel</option>
                  <option value="House">House</option>
                </select>
              </div>
              <TextField id="res-cap" label="Capacity" type="number" placeholder="Optional" value={formCapacity} onChange={(e) => setFormCapacity(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Residence'}</Button>
            </div>
          </form>
        </Card>
      )}

      {residences.length === 0 ? (
        <EmptyState title="No residences" description="Create your first residence above." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Capacity</th>
                  <th scope="col" className="px-4 py-3">Supervisor</th>
                  <th scope="col" className="px-4 py-3">Occupants</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {residences.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{r.residence_type}</Badge></td>
                    <td className="px-4 py-2.5 text-gray-700">{r.capacity ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{r.supervisor_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{r.occupant_count}</td>
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
