'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  createBoardingRollCall,
  createMealPlan,
  describeAnalyticsError,
  getBoardingRollCalls,
  getMealPlans,
  getStudentResidences,
  isAbortError,
  saveBoardingRollCallEntries,
  saveMealAttendance,
} from '@/lib/analytics/api';
import type { BoardingRollCall, MealPlan, StudentResidence } from '@/lib/analytics/types';

export default function BoardingPage() {
  const [residences, setResidences] = useState<StudentResidence[]>([]);
  const [residenceId, setResidenceId] = useState('');
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [rollCalls, setRollCalls] = useState<BoardingRollCall[]>([]);
  const [tab, setTab] = useState<'meals' | 'rollcalls'>('meals');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showMealForm, setShowMealForm] = useState(false);
  const [mealDate, setMealDate] = useState(new Date().toISOString().split('T')[0]);
  const [mealType, setMealType] = useState('breakfast');
  const [mealMenu, setMealMenu] = useState('');
  const [saving, setSaving] = useState(false);
  const [showRcForm, setShowRcForm] = useState(false);
  const [rcDate, setRcDate] = useState(new Date().toISOString().split('T')[0]);
  const [rcTime, setRcTime] = useState('21:00');
  const [rcType, setRcType] = useState('evening');

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getStudentResidences({ signal: controller.signal }),
    ])
      .then(([r]) => {
        if (!active) return;
        setResidences(r);
        if (r.length > 0) setResidenceId(r[0].id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load residences.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const loadMeals = useCallback(() => {
    if (!residenceId) return;
    const controller = new AbortController();
    let active = true;
    getMealPlans(residenceId, undefined, { signal: controller.signal })
      .then((data) => { if (!active) return; setMealPlans(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load meal plans.')); });
    return () => { active = false; controller.abort(); };
  }, [residenceId]);

  const loadRollCalls = useCallback(() => {
    if (!residenceId) return;
    const controller = new AbortController();
    let active = true;
    getBoardingRollCalls(residenceId, undefined, { signal: controller.signal })
      .then((data) => { if (!active) return; setRollCalls(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load roll calls.')); });
    return () => { active = false; controller.abort(); };
  }, [residenceId]);

  useEffect(() => { const cleanup = loadMeals(); return cleanup; }, [loadMeals]);
  useEffect(() => { const cleanup = loadRollCalls(); return cleanup; }, [loadRollCalls]);

  const handleCreateMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId || !mealDate) { setActionError('Residence and date required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createMealPlan(residenceId, mealDate, mealType, mealMenu.trim() || undefined);
      setActionSuccess('Meal plan created.');
      setShowMealForm(false);
      setMealMenu('');
      loadMeals();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create meal plan.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRollCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId || !rcDate) { setActionError('Residence and date required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createBoardingRollCall(residenceId, rcDate, rcTime, rcType);
      setActionSuccess('Roll call created.');
      setShowRcForm(false);
      loadRollCalls();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create roll call.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading boarding…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load boarding">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Boarding
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Boarding Management</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage meal plans and boarding roll calls.</p>
        </div>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="board-residence" label="Residence" value={residenceId} onChange={(e) => setResidenceId(e.target.value)}>
            {residences.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
          </SelectField>
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {(['meals', 'rollcalls'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition ${
              tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'meals' ? 'Meal Plans' : 'Roll Calls'}
          </button>
        ))}
      </div>

      {tab === 'meals' && (
        <>
          <div className="mb-4 flex justify-end">
            <Button variant="primary" onClick={() => setShowMealForm((v) => !v)}>
              {showMealForm ? 'Close' : '+ Add Meal Plan'}
            </Button>
          </div>
          {showMealForm && (
            <Card className="mb-6">
              <CardHeader title="Create Meal Plan" />
              <form onSubmit={handleCreateMeal} className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField id="meal-date" label="Date" type="date" required value={mealDate} onChange={(e) => setMealDate(e.target.value)} />
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Meal Type</label>
                    <select value={mealType} onChange={(e) => setMealType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                      <option value="breakfast">Breakfast</option>
                      <option value="lunch">Lunch</option>
                      <option value="dinner">Dinner</option>
                      <option value="snack">Snack</option>
                    </select>
                  </div>
                  <TextField id="meal-menu" label="Menu" value={mealMenu} onChange={(e) => setMealMenu(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Meal Plan'}</Button>
                </div>
              </form>
            </Card>
          )}
          {mealPlans.length === 0 ? (
            <EmptyState title="No meal plans" />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Date</th>
                      <th scope="col" className="px-4 py-3">Type</th>
                      <th scope="col" className="px-4 py-3">Menu</th>
                      <th scope="col" className="px-4 py-3">Present</th>
                      <th scope="col" className="px-4 py-3">Absent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {mealPlans.map((m) => (
                      <tr key={m.plan_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-600">{m.meal_date}</td>
                        <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{m.meal_type}</Badge></td>
                        <td className="px-4 py-2.5 text-gray-700">{m.menu || '—'}</td>
                        <td className="px-4 py-2.5 text-emerald-700">{m.present_count}</td>
                        <td className="px-4 py-2.5 text-red-700">{m.absent_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === 'rollcalls' && (
        <>
          <div className="mb-4 flex justify-end">
            <Button variant="primary" onClick={() => setShowRcForm((v) => !v)}>
              {showRcForm ? 'Close' : '+ Create Roll Call'}
            </Button>
          </div>
          {showRcForm && (
            <Card className="mb-6">
              <CardHeader title="Create Boarding Roll Call" />
              <form onSubmit={handleCreateRollCall} className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField id="rc-date" label="Date" type="date" required value={rcDate} onChange={(e) => setRcDate(e.target.value)} />
                  <TextField id="rc-time" label="Time" type="time" value={rcTime} onChange={(e) => setRcTime(e.target.value)} />
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                    <select value={rcType} onChange={(e) => setRcType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                      <option value="morning">Morning</option>
                      <option value="evening">Evening</option>
                      <option value="night">Night</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Roll Call'}</Button>
                </div>
              </form>
            </Card>
          )}
          {rollCalls.length === 0 ? (
            <EmptyState title="No roll calls" />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Date</th>
                      <th scope="col" className="px-4 py-3">Time</th>
                      <th scope="col" className="px-4 py-3">Type</th>
                      <th scope="col" className="px-4 py-3">Present</th>
                      <th scope="col" className="px-4 py-3">Absent</th>
                      <th scope="col" className="px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {rollCalls.map((r) => (
                      <tr key={r.roll_call_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-600">{r.roll_call_date}</td>
                        <td className="px-4 py-2.5 text-gray-600">{r.roll_call_time}</td>
                        <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{r.roll_call_type}</Badge></td>
                        <td className="px-4 py-2.5 text-emerald-700">{r.present_count}</td>
                        <td className="px-4 py-2.5 text-red-700">{r.absent_count}</td>
                        <td className="px-4 py-2.5 text-gray-700">{r.total_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
