'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  createEvent,
  createNotice,
  describeAnalyticsError,
  getEvents,
  getNotices,
  isAbortError,
} from '@/lib/analytics/api';
import type { EventRow, NoticeRow } from '@/lib/analytics/types';

export default function EventsPage() {
  const [tab, setTab] = useState<'events' | 'notices'>('events');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Event form
  const [showEventForm, setShowEventForm] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evType, setEvType] = useState('general');
  const [evStart, setEvStart] = useState('');
  const [evEnd, setEvEnd] = useState('');
  const [evLocation, setEvLocation] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);

  // Notice form
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [ntTitle, setNtTitle] = useState('');
  const [ntContent, setNtContent] = useState('');
  const [ntType, setNtType] = useState('general');
  const [ntAudience, setNtAudience] = useState('all');
  const [ntPublished, setNtPublished] = useState(false);
  const [savingNotice, setSavingNotice] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getEvents(undefined, undefined, { signal: controller.signal }),
      getNotices(undefined, { signal: controller.signal }),
    ])
      .then(([e, n]) => { if (!active) return; setEvents(e); setNotices(n); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load events.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim() || !evStart) { setActionError('Title and start date are required.'); return; }
    setSavingEvent(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createEvent(evTitle.trim(), evDesc.trim() || undefined, evType, new Date(evStart).toISOString(), evEnd ? new Date(evEnd).toISOString() : undefined, evLocation.trim() || undefined);
      setActionSuccess('Event created.');
      setShowEventForm(false);
      setEvTitle(''); setEvDesc(''); setEvStart(''); setEvEnd(''); setEvLocation('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create event.'));
    } finally {
      setSavingEvent(false);
    }
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ntTitle.trim() || !ntContent.trim()) { setActionError('Title and content are required.'); return; }
    setSavingNotice(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createNotice(ntTitle.trim(), ntContent.trim(), ntType, ntAudience, ntPublished);
      setActionSuccess('Notice created.');
      setShowNoticeForm(false);
      setNtTitle(''); setNtContent('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create notice.'));
    } finally {
      setSavingNotice(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading events…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load events">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Events & Notices
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Events & Notices</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage school events and notices.</p>
        </div>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {(['events', 'notices'] as const).map((t) => (
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

      {tab === 'events' && (
        <>
          <div className="mb-4 flex justify-end">
            <Button variant="primary" onClick={() => setShowEventForm((v) => !v)}>
              {showEventForm ? 'Close' : '+ Add Event'}
            </Button>
          </div>
          {showEventForm && (
            <Card className="mb-6">
              <CardHeader title="Create Event" />
              <form onSubmit={handleCreateEvent} className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField id="ev-title" label="Title" required value={evTitle} onChange={(e) => setEvTitle(e.target.value)} />
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                    <select value={evType} onChange={(e) => setEvType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                      <option value="general">General</option>
                      <option value="academic">Academic</option>
                      <option value="sports">Sports</option>
                      <option value="cultural">Cultural</option>
                      <option value="meeting">Meeting</option>
                      <option value="holiday">Holiday</option>
                    </select>
                  </div>
                  <TextField id="ev-start" label="Start Date/Time" type="datetime-local" required value={evStart} onChange={(e) => setEvStart(e.target.value)} />
                  <TextField id="ev-end" label="End Date/Time" type="datetime-local" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} />
                  <TextField id="ev-location" label="Location" value={evLocation} onChange={(e) => setEvLocation(e.target.value)} />
                  <TextField id="ev-desc" label="Description" value={evDesc} onChange={(e) => setEvDesc(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingEvent}>{savingEvent ? 'Saving…' : 'Create Event'}</Button>
                </div>
              </form>
            </Card>
          )}
          {events.length === 0 ? (
            <EmptyState title="No events" />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Title</th>
                      <th scope="col" className="px-4 py-3">Type</th>
                      <th scope="col" className="px-4 py-3">Start</th>
                      <th scope="col" className="px-4 py-3">Location</th>
                      <th scope="col" className="px-4 py-3">Created By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {events.map((e) => (
                      <tr key={e.event_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{e.title}</td>
                        <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{e.event_type}</Badge></td>
                        <td className="px-4 py-2.5 text-gray-600">{new Date(e.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="px-4 py-2.5 text-gray-700">{e.location || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{e.created_by_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === 'notices' && (
        <>
          <div className="mb-4 flex justify-end">
            <Button variant="primary" onClick={() => setShowNoticeForm((v) => !v)}>
              {showNoticeForm ? 'Close' : '+ Add Notice'}
            </Button>
          </div>
          {showNoticeForm && (
            <Card className="mb-6">
              <CardHeader title="Create Notice" />
              <form onSubmit={handleCreateNotice} className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField id="nt-title" label="Title" required value={ntTitle} onChange={(e) => setNtTitle(e.target.value)} />
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                    <select value={ntType} onChange={(e) => setNtType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                      <option value="general">General</option>
                      <option value="academic">Academic</option>
                      <option value="urgent">Urgent</option>
                      <option value="reminder">Reminder</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Audience</label>
                    <select value={ntAudience} onChange={(e) => setNtAudience(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                      <option value="all">All</option>
                      <option value="students">Students</option>
                      <option value="teachers">Teachers</option>
                      <option value="parents">Parents</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="nt-published" checked={ntPublished} onChange={(e) => setNtPublished(e.target.checked)} />
                    <label htmlFor="nt-published" className="text-sm text-gray-700">Publish immediately</label>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Content</label>
                  <textarea rows={4} required value={ntContent} onChange={(e) => setNtContent(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingNotice}>{savingNotice ? 'Saving…' : 'Create Notice'}</Button>
                </div>
              </form>
            </Card>
          )}
          {notices.length === 0 ? (
            <EmptyState title="No notices" />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Title</th>
                      <th scope="col" className="px-4 py-3">Type</th>
                      <th scope="col" className="px-4 py-3">Audience</th>
                      <th scope="col" className="px-4 py-3">Published</th>
                      <th scope="col" className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {notices.map((n) => (
                      <tr key={n.notice_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{n.title}</td>
                        <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{n.notice_type}</Badge></td>
                        <td className="px-4 py-2.5 text-gray-700">{n.target_audience}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={n.is_published ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>
                            {n.is_published ? 'Published' : 'Draft'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
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
