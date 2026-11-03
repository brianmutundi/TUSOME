'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getAnalyticsFilters,
  getTimetable,
  isAbortError,
  upsertTimetableSlot,
} from '@/lib/analytics/api';
import type { AnalyticsFilterOptions } from '@/lib/analytics/api';
import type { ClassOption, TimetableEntry } from '@/lib/analytics/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetablePage() {
  const [options, setOptions] = useState<AnalyticsFilterOptions>({ exams: [], classes: [], streams: [] });
  const [classId, setClassId] = useState('');
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotDay, setSlotDay] = useState('1');
  const [slotPeriod, setSlotPeriod] = useState('1');
  const [slotStart, setSlotStart] = useState('08:00');
  const [slotEnd, setSlotEnd] = useState('09:00');
  const [slotLabel, setSlotLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getAnalyticsFilters({ signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setOptions(data);
        if (data.classes.length > 0) setClassId(data.classes[0].id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load filters.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  const loadEntries = useCallback(() => {
    if (!classId) { setEntries([]); return; }
    const controller = new AbortController();
    let active = true;
    setLoadingEntries(true);
    getTimetable(classId, undefined, { signal: controller.signal })
      .then((data) => { if (!active) return; setEntries(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load timetable.')); })
      .finally(() => { if (active) setLoadingEntries(false); });
    return () => { active = false; controller.abort(); };
  }, [classId]);

  useEffect(() => { const cleanup = loadEntries(); return cleanup; }, [loadEntries]);

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertTimetableSlot(Number(slotDay), Number(slotPeriod), slotStart, slotEnd, slotLabel || undefined);
      setShowSlotForm(false);
      setSlotLabel('');
      loadEntries();
    } catch (caught) {
      setError(describeAnalyticsError(caught, 'Could not save slot.'));
    } finally {
      setSaving(false);
    }
  };

  // Group entries by day
  const byDay = DAYS.map((day, i) => ({
    day,
    index: i,
    slots: entries.filter((e) => e.day_of_week === i).sort((a, b) => a.period_number - b.period_number),
  }));

  if (loading) return <LoadingPanel label="Loading timetable…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load timetable">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Timetable
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Timetable</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">View and manage class timetables.</p>
        </div>
        <Button variant="primary" onClick={() => setShowSlotForm((v) => !v)}>
          {showSlotForm ? 'Close' : '+ Add Slot'}
        </Button>
      </div>

      {showSlotForm && (
        <Card className="mb-6">
          <CardHeader title="Add Timetable Slot" />
          <form onSubmit={handleSaveSlot} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Day</label>
                <select value={slotDay} onChange={(e) => setSlotDay(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  {DAYS.map((d, i) => (<option key={i} value={i}>{d}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Period</label>
                <input type="number" min="1" value={slotPeriod} onChange={(e) => setSlotPeriod(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Start</label>
                <input type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">End</label>
                <input type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
              </div>
              <TextField id="slot-label" label="Label" placeholder="e.g. Period 1" value={slotLabel} onChange={(e) => setSlotLabel(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Slot'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="tt-class" label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {options.classes.map((c: ClassOption) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </SelectField>
        </div>
      </Card>

      {loadingEntries ? (
        <LoadingPanel label="Loading timetable…" />
      ) : entries.length === 0 ? (
        <EmptyState title="No timetable entries" />
      ) : (
        <div className="space-y-6">
          {byDay.filter((d) => d.slots.length > 0).map((d) => (
            <Card key={d.index}>
              <CardHeader title={d.day} />
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Period</th>
                      <th scope="col" className="px-4 py-3">Time</th>
                      <th scope="col" className="px-4 py-3">Subject</th>
                      <th scope="col" className="px-4 py-3">Teacher</th>
                      <th scope="col" className="px-4 py-3">Room</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {d.slots.map((s) => (
                      <tr key={s.slot_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{s.slot_label || `Period ${s.period_number}`}</td>
                        <td className="px-4 py-2.5 text-gray-600">{s.start_time} – {s.end_time}</td>
                        <td className="px-4 py-2.5 text-gray-700">{s.subject_name || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{s.teacher_name || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600">{s.room || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
