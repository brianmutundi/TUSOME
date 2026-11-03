'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, TextField } from '@/components/ui';
import {
  addVehicle,
  createTransportRoute,
  describeAnalyticsError,
  getTransportRoutes,
  getVehicles,
  isAbortError,
} from '@/lib/analytics/api';
import type { TransportRoute, Vehicle } from '@/lib/analytics/types';

export default function TransportPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [tab, setTab] = useState<'vehicles' | 'routes'>('vehicles');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [formReg, setFormReg] = useState('');
  const [formType, setFormType] = useState('bus');
  const [formCapacity, setFormCapacity] = useState('');
  const [formMake, setFormMake] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formRouteName, setFormRouteName] = useState('');
  const [formVehicleId, setFormVehicleId] = useState('');
  const [formPickup, setFormPickup] = useState('');
  const [formDeparture, setFormDeparture] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getVehicles({ signal: controller.signal }),
      getTransportRoutes({ signal: controller.signal }),
    ])
      .then(([v, r]) => {
        if (!active) return;
        setVehicles(v);
        setRoutes(r);
        if (v.length > 0) setFormVehicleId(v[0].vehicle_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load transport data.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formReg.trim()) { setActionError('Registration number required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await addVehicle(formReg.trim(), formType, Number(formCapacity) || 0, formMake.trim() || undefined, formModel.trim() || undefined);
      setActionSuccess('Vehicle added.');
      setShowVehicleForm(false);
      setFormReg(''); setFormMake(''); setFormModel(''); setFormCapacity('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not add vehicle.'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRouteName.trim()) { setActionError('Route name required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createTransportRoute(formRouteName.trim(), undefined, formVehicleId || undefined, undefined, formPickup.trim() || undefined, formDeparture || undefined);
      setActionSuccess('Route created.');
      setShowRouteForm(false);
      setFormRouteName(''); setFormPickup(''); setFormDeparture('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create route.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading transport…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load transport">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Transport
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Transport Management</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage vehicles, routes, and student transport assignments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setShowVehicleForm((v) => !v)}>{showVehicleForm ? 'Close' : '+ Add Vehicle'}</Button>
          <Button variant="secondary" onClick={() => setShowRouteForm((v) => !v)}>{showRouteForm ? 'Close' : '+ Add Route'}</Button>
        </div>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showVehicleForm && (
        <Card className="mb-6">
          <CardHeader title="Add Vehicle" />
          <form onSubmit={handleAddVehicle} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField id="veh-reg" label="Registration No." required value={formReg} onChange={(e) => setFormReg(e.target.value)} />
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="bus">Bus</option>
                  <option value="van">Van</option>
                  <option value="car">Car</option>
                  <option value="motorcycle">Motorcycle</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <TextField id="veh-cap" label="Capacity" type="number" value={formCapacity} onChange={(e) => setFormCapacity(e.target.value)} />
              <TextField id="veh-make" label="Make" value={formMake} onChange={(e) => setFormMake(e.target.value)} />
              <TextField id="veh-model" label="Model" value={formModel} onChange={(e) => setFormModel(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Vehicle'}</Button>
            </div>
          </form>
        </Card>
      )}

      {showRouteForm && (
        <Card className="mb-6">
          <CardHeader title="Add Transport Route" />
          <form onSubmit={handleAddRoute} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField id="route-name" label="Route Name" required value={formRouteName} onChange={(e) => setFormRouteName(e.target.value)} />
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Vehicle</label>
                <select value={formVehicleId} onChange={(e) => setFormVehicleId(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="">Select vehicle</option>
                  {vehicles.map((v) => (<option key={v.vehicle_id} value={v.vehicle_id}>{v.registration_number}</option>))}
                </select>
              </div>
              <TextField id="route-pickup" label="Pickup Points" value={formPickup} onChange={(e) => setFormPickup(e.target.value)} />
              <TextField id="route-departure" label="Departure Time" type="time" value={formDeparture} onChange={(e) => setFormDeparture(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Route'}</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {(['vehicles', 'routes'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition ${
              tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'vehicles' && (
        vehicles.length === 0 ? (
          <EmptyState title="No vehicles" />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Registration</th>
                    <th scope="col" className="px-4 py-3">Type</th>
                    <th scope="col" className="px-4 py-3">Make/Model</th>
                    <th scope="col" className="px-4 py-3">Capacity</th>
                    <th scope="col" className="px-4 py-3">Year</th>
                    <th scope="col" className="px-4 py-3">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {vehicles.map((v) => (
                    <tr key={v.vehicle_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{v.registration_number}</td>
                      <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{v.vehicle_type}</Badge></td>
                      <td className="px-4 py-2.5 text-gray-700">{v.make || ''} {v.model || ''}</td>
                      <td className="px-4 py-2.5 text-gray-700">{v.capacity}</td>
                      <td className="px-4 py-2.5 text-gray-600">{v.year || '—'}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={v.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>{v.is_active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {tab === 'routes' && (
        routes.length === 0 ? (
          <EmptyState title="No routes" />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Route</th>
                    <th scope="col" className="px-4 py-3">Vehicle</th>
                    <th scope="col" className="px-4 py-3">Driver</th>
                    <th scope="col" className="px-4 py-3">Departure</th>
                    <th scope="col" className="px-4 py-3">Students</th>
                    <th scope="col" className="px-4 py-3">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {routes.map((r) => (
                    <tr key={r.route_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.registration_number || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.driver_name || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.departure_time || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.student_count}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={r.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}
    </main>
  );
}
