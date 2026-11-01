'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, TextField } from '@/components/ui';
import {
  createTrip,
  describeAnalyticsError,
  getTrips,
  isAbortError,
  updateTripStatus,
} from '@/lib/analytics/api';
import type { Trip } from '@/lib/analytics/types';

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDest, setFormDest] = useState('');
  const [formType, setFormType] = useState('educational');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formTransport, setFormTransport] = useState('');
  const [formCost, setFormCost] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    getTrips(undefined, { signal: controller.signal })
      .then((data) => { if (!active) return; setTrips(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load trips.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDest.trim() || !formStart || !formEnd) { setActionError('Title, destination, and dates required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createTrip(formTitle.trim(), formDest.trim(), formStart, formEnd, formType, undefined, undefined, undefined, formTransport.trim() || undefined, formCost ? Number(formCost) : undefined);
      setActionSuccess('Trip created.');
      setShowForm(false);
      setFormTitle(''); setFormDest(''); setFormStart(''); setFormEnd(''); setFormTransport(''); setFormCost('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create trip.'));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (tripId: string, status: string) => {
    try {
      await updateTripStatus(tripId, status);
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not update status.'));
    }
  };

  if (loading) return <LoadingPanel label="Loading trips…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load trips">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Trips
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Trips & Excursions</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Plan and manage school trips with permission slips.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Plan Trip'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Plan Trip" />
          <form onSubmit={handleCreate} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField id="trip-title" label="Title" required value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              <TextField id="trip-dest" label="Destination" required value={formDest} onChange={(e) => setFormDest(e.target.value)} />
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="educational">Educational</option>
                  <option value="sports">Sports</option>
                  <option value="cultural">Cultural</option>
                  <option value="religious">Religious</option>
                  <option value="social">Social</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <TextField id="trip-start" label="Start Date" type="date" required value={formStart} onChange={(e) => setFormStart(e.target.value)} />
              <TextField id="trip-end" label="End Date" type="date" required value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
              <TextField id="trip-transport" label="Transport Mode" value={formTransport} onChange={(e) => setFormTransport(e.target.value)} />
              <TextField id="trip-cost" label="Estimated Cost" type="number" value={formCost} onChange={(e) => setFormCost(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Plan Trip'}</Button>
            </div>
          </form>
        </Card>
      )}

      {trips.length === 0 ? (
        <EmptyState title="No trips" description="Plan your first trip above." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Title</th>
                  <th scope="col" className="px-4 py-3">Destination</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Start</th>
                  <th scope="col" className="px-4 py-3">End</th>
                  <th scope="col" className="px-4 py-3">Participants</th>
                  <th scope="col" className="px-4 py-3">Permission Slips</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {trips.map((t) => (
                  <tr key={t.trip_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{t.title}</td>
                    <td className="px-4 py-2.5 text-gray-700">{t.destination}</td>
                    <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{t.trip_type}</Badge></td>
                    <td className="px-4 py-2.5 text-gray-600">{t.start_date}</td>
                    <td className="px-4 py-2.5 text-gray-600">{t.end_date}</td>
                    <td className="px-4 py-2.5 text-gray-700">{t.participant_count}</td>
                    <td className="px-4 py-2.5 text-gray-700">{t.permission_slip_count}/{t.participant_count}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={t.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : t.status === 'cancelled' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}>{t.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {t.status === 'planned' && <Button variant="secondary" onClick={() => handleStatusChange(t.trip_id, 'approved')}>Approve</Button>}
                        {t.status === 'approved' && <Button variant="secondary" onClick={() => handleStatusChange(t.trip_id, 'in_progress')}>Start</Button>}
                        {t.status === 'in_progress' && <Button variant="secondary" onClick={() => handleStatusChange(t.trip_id, 'completed')}>Complete</Button>}
                      </div>
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
