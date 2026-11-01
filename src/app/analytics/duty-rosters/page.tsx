'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  createDutyRoster,
  describeAnalyticsError,
  getDutyAssignments,
  getDutyRosters,
  getStaffDirectory,
  isAbortError,
} from '@/lib/analytics/api';
import type { DutyAssignment, DutyRoster, StaffDirectoryRow } from '@/lib/analytics/types';

export default function DutyRostersPage() {
  const [rosters, setRosters] = useState<DutyRoster[]>([]);
  const [staff, setStaff] = useState<StaffDirectoryRow[]>([]);
  const [selectedRoster, setSelectedRoster] = useState('');
  const [assignments, setAssignments] = useState<DutyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('general');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getDutyRosters({ signal: controller.signal }),
      getStaffDirectory(undefined, { signal: controller.signal }),
    ])
      .then(([r, s]) => {
        if (!active) return;
        setRosters(r);
        setStaff(s);
        if (r.length > 0) setSelectedRoster(r[0].roster_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load duty rosters.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  useEffect(() => {
    if (!selectedRoster) { setAssignments([]); return; }
    const controller = new AbortController();
    let active = true;
    getDutyAssignments(selectedRoster, { signal: controller.signal })
      .then((data) => { if (!active) return; setAssignments(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load assignments.')); });
    return () => { active = false; controller.abort(); };
  }, [selectedRoster]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStart || !formEnd) { setActionError('Start and end dates required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createDutyRoster(formType, formStart, formEnd, formDesc.trim() || undefined);
      setActionSuccess('Duty roster created.');
      setShowForm(false);
      setFormStart(''); setFormEnd(''); setFormDesc('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create roster.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading duty rosters…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load duty rosters">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Duty Rosters
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Duty Rosters</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage staff duty rosters and assignments.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Create Roster'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Create Duty Roster" />
          <form onSubmit={handleCreate} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Duty Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="general">General</option>
                  <option value="assembly">Assembly</option>
                  <option value="break">Break</option>
                  <option value="lunch">Lunch</option>
                  <option value="gate">Gate</option>
                  <option value="library">Library</option>
                  <option value="lab">Lab</option>
                  <option value="sports">Sports</option>
                </select>
              </div>
              <TextField id="dr-start" label="Start Date" type="date" required value={formStart} onChange={(e) => setFormStart(e.target.value)} />
              <TextField id="dr-end" label="End Date" type="date" required value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
              <TextField id="dr-desc" label="Description" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Roster'}</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Roster list */}
        <Card>
          <CardHeader title="Rosters" description={`${rosters.length} roster(s)`} />
          {rosters.length === 0 ? (
            <EmptyState title="No rosters" description="Create your first roster above." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Type</th>
                    <th scope="col" className="px-4 py-3">Start</th>
                    <th scope="col" className="px-4 py-3">End</th>
                    <th scope="col" className="px-4 py-3">Assignments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {rosters.map((r) => (
                    <tr key={r.roster_id} className={`hover:bg-gray-50 cursor-pointer ${selectedRoster === r.roster_id ? 'bg-blue-50' : ''}`} onClick={() => setSelectedRoster(r.roster_id)}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{r.duty_type}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.start_date}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.end_date}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.assignment_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Assignments */}
        <Card>
          <CardHeader title="Assignments" description={selectedRoster ? `${assignments.length} assignment(s)` : 'Select a roster'} />
          {assignments.length === 0 ? (
            <EmptyState title="No assignments" description="Select a roster to view assignments." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Staff</th>
                    <th scope="col" className="px-4 py-3">Date</th>
                    <th scope="col" className="px-4 py-3">Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {assignments.map((a) => (
                    <tr key={a.assignment_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{a.staff_name || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{a.duty_date}</td>
                      <td className="px-4 py-2.5 text-gray-700">{a.duty_period || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
