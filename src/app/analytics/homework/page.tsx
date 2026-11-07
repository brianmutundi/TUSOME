'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  createHomework,
  deleteHomework,
  describeAnalyticsError,
  getClassesWithStreams,
  getHomeworkScopes,
  isAbortError,
  listHomework,
  updateHomework,
  type HomeworkItem,
  type HomeworkScope,
} from '@/lib/analytics/api';
import type { ClassWithStreams } from '@/lib/analytics/types';
import { homeworkDaysUntil, homeworkErrorMessage, toDateOnly } from '@/lib/homework';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';

interface Draft {
  classId: string;
  streamId: string;
  subjectId: string;
  title: string;
  instructions: string;
  dueDate: string;
  publish: boolean;
}

const blankDraft = (): Draft => ({
  classId: '',
  streamId: '',
  subjectId: '',
  title: '',
  instructions: '',
  dueDate: toDateOnly(new Date(Date.now() + 86_400_000)),
  publish: true,
});

function formatDue(dueDate: string): string {
  const d = new Date(`${dueDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dueDate : d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function HomeworkPage() {
  const [scopes, setScopes] = useState<HomeworkScope[] | null>(null);
  const [streamRows, setStreamRows] = useState<ClassWithStreams[]>([]);
  const [items, setItems] = useState<HomeworkItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editing, setEditing] = useState<HomeworkItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    setLoadError(null);
    Promise.all([getHomeworkScopes(opts), listHomework(opts)])
      .then(([s, list]) => {
        setScopes(s);
        setItems(list);
      })
      .catch((caught) => {
        if (isAbortError(caught)) return;
        setLoadError(describeAnalyticsError(caught, 'Could not load homework.'));
      });
    // Streams are optional: without them homework is set for the whole class.
    getClassesWithStreams(opts)
      .then(setStreamRows)
      .catch((caught) => !isAbortError(caught) && console.error('getClassesWithStreams failed:', caught));
    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => {
    setItems(null);
    setScopes(null);
    setAttempt((n) => n + 1);
  }, []);

  const classes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of scopes ?? []) seen.set(s.classId, s.className);
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [scopes]);
  const subjects = useMemo(() => (scopes ?? []).filter((s) => s.classId === draft.classId), [scopes, draft.classId]);
  const streams = useMemo(
    () => streamRows.filter((r) => r.class_id === draft.classId && r.stream_id).map((r) => ({ id: r.stream_id as string, name: r.stream_name ?? '' })),
    [streamRows, draft.classId]
  );

  const openNew = () => {
    setEditing(null);
    setActionError(null);
    setDraft({ ...blankDraft(), classId: classes[0]?.id ?? '' });
    setShowForm(true);
  };
  const openEdit = (item: HomeworkItem) => {
    setEditing(item);
    setActionError(null);
    setDraft({
      classId: item.classId,
      streamId: item.streamId ?? '',
      subjectId: item.subjectId,
      title: item.title,
      instructions: item.instructions ?? '',
      dueDate: item.dueDate,
      publish: item.isPublished,
    });
    setShowForm(true);
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const chooseClass = (classId: string) => setDraft((d) => ({ ...d, classId, streamId: '', subjectId: '' }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const subjectId = editing ? editing.subjectId : draft.subjectId || subjects[0]?.subjectId || '';
    if (!draft.classId || !subjectId) {
      setActionError('Choose a class and a subject.');
      return;
    }
    setSaving(true);
    try {
      const input = { title: draft.title, instructions: draft.instructions, dueDate: draft.dueDate, publish: draft.publish };
      if (editing) await updateHomework(editing.assignmentId, input);
      else await createHomework({ classId: draft.classId, streamId: draft.streamId || null, subjectId }, input);
      setShowForm(false);
      setEditing(null);
      reload();
    } catch (caught) {
      setActionError(homeworkErrorMessage(caught, 'Could not save the homework. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (item: HomeworkItem) => {
    setBusyId(item.assignmentId);
    setActionError(null);
    try {
      await updateHomework(item.assignmentId, {
        title: item.title,
        instructions: item.instructions ?? '',
        dueDate: item.dueDate,
        publish: !item.isPublished,
      });
      reload();
    } catch (caught) {
      setActionError(homeworkErrorMessage(caught, 'Could not change the status. Please try again.'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: HomeworkItem) => {
    if (!window.confirm(`Delete "${item.title}"? Parents will no longer see it and their ticks are removed.`)) return;
    setBusyId(item.assignmentId);
    setActionError(null);
    try {
      await deleteHomework(item.assignmentId);
      reload();
    } catch (caught) {
      setActionError(homeworkErrorMessage(caught, 'Could not delete the homework. Please try again.'));
    } finally {
      setBusyId(null);
    }
  };

  if (loadError) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load homework" action={<Button variant="secondary" size="sm" onClick={reload}>Try again</Button>}>
          {loadError}
        </Alert>
      </main>
    );
  }
  if (!scopes || !items) return <LoadingPanel label="Loading homework…" />;

  const today = new Date();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Homework
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Homework</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Set homework for your classes. Published items appear in the parent app. Parents tick items as done; that is
            their own note, not a mark.
          </p>
        </div>
        <Button onClick={showForm ? () => setShowForm(false) : openNew} disabled={!showForm && classes.length === 0}>
          {showForm ? 'Close' : '+ New homework'}
        </Button>
      </div>

      {classes.length === 0 && (
        <div className="mb-6">
          <Alert tone="info" title="No classes to set homework for">
            You are not allocated to any class and subject yet. Ask an administrator to assign you under Classes & Streams.
          </Alert>
        </div>
      )}

      {actionError && <div className="mb-4"><Alert tone="error" title="Could not complete that">{actionError}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title={editing ? 'Edit homework' : 'New homework'} description={editing ? `${editing.className}${editing.streamName ? ` ${editing.streamName}` : ''} · ${editing.subjectName}` : undefined} />
          <form onSubmit={submit} className="space-y-4 p-5">
            {!editing && (
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField id="hw-class" label="Class" value={draft.classId} onChange={(e) => chooseClass(e.target.value)}>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </SelectField>
                <SelectField id="hw-subject" label="Subject" value={draft.subjectId || subjects[0]?.subjectId || ''} onChange={(e) => set('subjectId', e.target.value)}>
                  {subjects.map((s) => <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>)}
                </SelectField>
                <SelectField id="hw-stream" label="Stream" value={draft.streamId} onChange={(e) => set('streamId', e.target.value)}>
                  <option value="">Whole class</option>
                  {streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </SelectField>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="hw-title" label="Title" className="sm:col-span-2" value={draft.title} maxLength={120} required onChange={(e) => set('title', e.target.value)} />
              <TextField id="hw-due" label="Due date" type="date" value={draft.dueDate} min={editing ? undefined : toDateOnly(new Date())} required onChange={(e) => set('dueDate', e.target.value)} />
            </div>
            <div>
              <label htmlFor="hw-instructions" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Instructions (optional)</label>
              <textarea
                id="hw-instructions"
                rows={4}
                maxLength={2000}
                value={draft.instructions}
                onChange={(e) => set('instructions', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <p className="mt-1 text-xs text-gray-500">{draft.instructions.length}/2000. Text only: no attachments.</p>
            </div>
            <label className="flex min-h-[2.75rem] items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={draft.publish} onChange={(e) => set('publish', e.target.checked)} className="h-4 w-4" />
              Publish to parents
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create homework'}</Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader title="Homework" description="Due in the last 30 days or later." />
        {items.length === 0 ? (
          <EmptyState title="No homework yet" description="Create an item and publish it to show it to parents." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((h) => {
              const overdue = homeworkDaysUntil(h.dueDate, today) < 0;
              const busy = busyId === h.assignmentId;
              return (
                <li key={h.assignmentId} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-sm font-semibold text-gray-900">{h.title}</span>
                      <Badge className={h.isPublished ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-100 text-gray-700'}>
                        {h.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                    </p>
                    <p className="mt-0.5 text-sm text-gray-600">
                      {h.subjectName} · {h.className}{h.streamName ? ` ${h.streamName}` : ''} · {overdue ? 'was due' : 'due'} {formatDue(h.dueDate)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {h.isPublished
                        ? `${h.doneCount} of ${h.studentCount} parents ticked it as done (self-reported)`
                        : 'Not visible to parents'}
                      {h.createdByName ? ` · Set by ${h.createdByName}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => togglePublish(h)}>{h.isPublished ? 'Unpublish' : 'Publish'}</Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => openEdit(h)}>Edit</Button>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => remove(h)}>Delete</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </main>
  );
}
