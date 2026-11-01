'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, TextField } from '@/components/ui';
import {
  createSport,
  createSportsEvent,
  describeAnalyticsError,
  getSports,
  getSportsEvents,
  isAbortError,
} from '@/lib/analytics/api';
import type { Sport, SportsEvent } from '@/lib/analytics/types';

export default function SportsPage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [events, setEvents] = useState<SportsEvent[]>([]);
  const [tab, setTab] = useState<'sports' | 'events'>('sports');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showSportForm, setShowSportForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('sport');
  const [formDesc, setFormDesc] = useState('');
  const [evTitle, setEvTitle] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evType, setEvType] = useState('match');
  const [evSport, setEvSport] = useState('');
  const [evVenue, setEvVenue] = useState('');
  const [evOpponent, setEvOpponent] = useState('');
  const [evResult, setEvResult] = useState('');
  const [evScore, setEvScore] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getSports({ signal: controller.signal }),
      getSportsEvents(undefined, { signal: controller.signal }),
    ])
      .then(([s, e]) => {
        if (!active) return;
        setSports(s);
        setEvents(e);
        if (s.length > 0) setEvSport(s[0].sport_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load sports data.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleCreateSport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { setActionError('Name is required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createSport(formName.trim(), formDesc.trim() || undefined, formType);
      setActionSuccess('Sport/activity created.');
      setShowSportForm(false);
      setFormName(''); setFormDesc('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create sport.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim() || !evDate) { setActionError('Title and date required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createSportsEvent(evTitle.trim(), evDate, evSport || undefined, evType, evVenue.trim() || undefined, evOpponent.trim() || undefined, evResult.trim() || undefined, evScore.trim() || undefined);
      setActionSuccess('Event created.');
      setShowEventForm(false);
      setEvTitle(''); setEvDate(''); setEvVenue(''); setEvOpponent(''); setEvResult(''); setEvScore('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create event.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading sports…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load sports">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Sports
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Sports & Competitions</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage sports, clubs, activities, and competitions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setShowSportForm((v) => !v)}>{showSportForm ? 'Close' : '+ Add Sport'}</Button>
          <Button variant="secondary" onClick={() => setShowEventForm((v) => !v)}>{showEventForm ? 'Close' : '+ Add Event'}</Button>
        </div>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showSportForm && (
        <Card className="mb-6">
          <CardHeader title="Add Sport/Activity" />
          <form onSubmit={handleCreateSport} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="sport-name" label="Name" required value={formName} onChange={(e) => setFormName(e.target.value)} />
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="sport">Sport</option>
                  <option value="club">Club</option>
                  <option value="activity">Activity</option>
                  <option value="competition">Competition</option>
                </select>
              </div>
              <TextField id="sport-desc" label="Description" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </form>
        </Card>
      )}

      {showEventForm && (
        <Card className="mb-6">
          <CardHeader title="Add Sports Event" />
          <form onSubmit={handleCreateEvent} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField id="ev-title" label="Title" required value={evTitle} onChange={(e) => setEvTitle(e.target.value)} />
              <TextField id="ev-date" label="Date" type="date" required value={evDate} onChange={(e) => setEvDate(e.target.value)} />
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Sport</label>
                <select value={evSport} onChange={(e) => setEvSport(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="">Select sport</option>
                  {sports.map((s) => (<option key={s.sport_id} value={s.sport_id}>{s.name}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                <select value={evType} onChange={(e) => setEvType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="match">Match</option>
                  <option value="tournament">Tournament</option>
                  <option value="training">Training</option>
                  <option value="competition">Competition</option>
                  <option value="friendly">Friendly</option>
                </select>
              </div>
              <TextField id="ev-venue" label="Venue" value={evVenue} onChange={(e) => setEvVenue(e.target.value)} />
              <TextField id="ev-opponent" label="Opponent" value={evOpponent} onChange={(e) => setEvOpponent(e.target.value)} />
              <TextField id="ev-result" label="Result" value={evResult} onChange={(e) => setEvResult(e.target.value)} />
              <TextField id="ev-score" label="Score" value={evScore} onChange={(e) => setEvScore(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Event'}</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {(['sports', 'events'] as const).map((t) => (
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

      {tab === 'sports' && (
        sports.length === 0 ? (
          <EmptyState title="No sports" description="Create your first sport or activity above." />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Name</th>
                    <th scope="col" className="px-4 py-3">Type</th>
                    <th scope="col" className="px-4 py-3">Events</th>
                    <th scope="col" className="px-4 py-3">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {sports.map((s) => (
                    <tr key={s.sport_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{s.sport_type}</Badge></td>
                      <td className="px-4 py-2.5 text-gray-700">{s.event_count}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={s.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {tab === 'events' && (
        events.length === 0 ? (
          <EmptyState title="No events" description="Create your first sports event above." />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Title</th>
                    <th scope="col" className="px-4 py-3">Sport</th>
                    <th scope="col" className="px-4 py-3">Type</th>
                    <th scope="col" className="px-4 py-3">Date</th>
                    <th scope="col" className="px-4 py-3">Opponent</th>
                    <th scope="col" className="px-4 py-3">Result</th>
                    <th scope="col" className="px-4 py-3">Score</th>
                    <th scope="col" className="px-4 py-3">Participants</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {events.map((e) => (
                    <tr key={e.event_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{e.title}</td>
                      <td className="px-4 py-2.5 text-gray-700">{e.sport_name || '—'}</td>
                      <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{e.event_type}</Badge></td>
                      <td className="px-4 py-2.5 text-gray-600">{e.event_date}</td>
                      <td className="px-4 py-2.5 text-gray-700">{e.opponent || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{e.result || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{e.score || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{e.participant_count}</td>
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
