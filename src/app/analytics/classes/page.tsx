'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getClassesWithStreams,
  isAbortError,
  upsertClass,
  upsertStream,
} from '@/lib/analytics/api';
import type { ClassWithStreams } from '@/lib/analytics/types';

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassWithStreams[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);
  const [streamClassId, setStreamClassId] = useState('');
  const [streamName, setStreamName] = useState('');
  const [showStreamForm, setShowStreamForm] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    getClassesWithStreams({ signal: controller.signal })
      .then((data) => { if (!active) return; setClasses(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load classes.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { setActionError('Name is required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertClass(formName.trim());
      setActionSuccess('Class created.');
      setShowForm(false);
      setFormName('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create class.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamClassId || !streamName.trim()) { setActionError('Class and stream name required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertStream(streamClassId, streamName.trim());
      setActionSuccess('Stream created.');
      setShowStreamForm(false);
      setStreamName('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create stream.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading classes…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load classes">{error}</Alert>
      </main>
    );
  }

  // Group by class
  const classMap = new Map<string, { name: string; streams: ClassWithStreams[] }>();
  for (const c of classes) {
    if (!classMap.has(c.class_id)) classMap.set(c.class_id, { name: c.class_name, streams: [] });
    classMap.get(c.class_id)!.streams.push(c);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Classes
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Classes & Streams</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage school classes and streams.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : '+ Add Class'}</Button>
          <Button variant="secondary" onClick={() => setShowStreamForm((v) => !v)}>{showStreamForm ? 'Close' : '+ Add Stream'}</Button>
        </div>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Add Class" />
          <form onSubmit={handleCreateClass} className="space-y-4 p-5">
            <TextField id="cls-name" label="Class Name" required placeholder="e.g. Form 1" value={formName} onChange={(e) => setFormName(e.target.value)} />
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Class'}</Button>
            </div>
          </form>
        </Card>
      )}

      {showStreamForm && (
        <Card className="mb-6">
          <CardHeader title="Add Stream" />
          <form onSubmit={handleCreateStream} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Class</label>
                <select value={streamClassId} onChange={(e) => setStreamClassId(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="">Select class</option>
                  {Array.from(classMap.entries()).map(([id, c]) => (<option key={id} value={id}>{c.name}</option>))}
                </select>
              </div>
              <TextField id="str-name" label="Stream Name" required placeholder="e.g. East" value={streamName} onChange={(e) => setStreamName(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Stream'}</Button>
            </div>
          </form>
        </Card>
      )}

      {classes.length === 0 ? (
        <EmptyState title="No classes" description="Create your first class above." />
      ) : (
        <div className="space-y-4">
          {Array.from(classMap.entries()).map(([classId, cls]) => (
            <Card key={classId}>
              <CardHeader title={cls.name} description={`${cls.streams.reduce((a, s) => a + (s.student_count || 0), 0)} students`} />
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Stream</th>
                      <th scope="col" className="px-4 py-3">Students</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {cls.streams.map((s) => (
                      <tr key={s.stream_id || s.class_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{s.stream_name || 'No stream'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{s.student_count}</td>
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
