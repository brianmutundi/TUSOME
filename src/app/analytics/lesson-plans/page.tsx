'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  createLessonPlan,
  describeAnalyticsError,
  getExamSetupOptions,
  getLessonPlans,
  isAbortError,
  updateLessonPlanStatus,
} from '@/lib/analytics/api';
import type { ExamSetupOptions } from '@/lib/analytics/types';
import type { ClassOption, LessonPlan, SubjectOption } from '@/lib/analytics/types';

export default function LessonPlansPage() {
  const [options, setOptions] = useState<ExamSetupOptions>({ classes: [], streams: [], subjects: [] });
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTopic, setFormTopic] = useState('');
  const [formSubtopic, setFormSubtopic] = useState('');
  const [formObjectives, setFormObjectives] = useState('');
  const [formActivities, setFormActivities] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getExamSetupOptions({ signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setOptions(data);
        if (data.subjects && data.subjects.length > 0) setSubjectId(data.subjects[0].id);
        if (data.classes.length > 0) setClassId(data.classes[0].id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load filters.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  const loadPlans = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    getLessonPlans(subjectId || undefined, classId || undefined, undefined, { signal: controller.signal })
      .then((data) => { if (!active) return; setPlans(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load lesson plans.')); });
    return () => { active = false; controller.abort(); };
  }, [subjectId, classId]);

  useEffect(() => { const cleanup = loadPlans(); return cleanup; }, [loadPlans]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTopic.trim()) { setActionError('Topic is required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createLessonPlan(formTopic.trim(), subjectId || undefined, classId || undefined, undefined, undefined, undefined, formSubtopic.trim() || undefined, formObjectives.trim() || undefined, undefined, formActivities.trim() || undefined, undefined, undefined, undefined, formDate || undefined, formDuration ? Number(formDuration) : undefined);
      setActionSuccess('Lesson plan created.');
      setShowForm(false);
      setFormTopic(''); setFormSubtopic(''); setFormObjectives(''); setFormActivities(''); setFormDate(''); setFormDuration('');
      loadPlans();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create lesson plan.'));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (planId: string, status: string) => {
    try {
      await updateLessonPlanStatus(planId, status, status === 'completed' ? 100 : 0);
      loadPlans();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not update status.'));
    }
  };

  if (loading) return <LoadingPanel label="Loading lesson plans…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load lesson plans">{error}</Alert>
      </main>
    );
  }

  const subjects = (options as any).subjects || [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Lesson Plans
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Lesson Plans</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Create and manage lesson plans with objectives, activities, and resources.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Lesson Plan'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      <Card className="mb-6">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <SelectField id="lp-subject" label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s: SubjectOption) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </SelectField>
          <SelectField id="lp-class" label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {options.classes.map((c: ClassOption) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </SelectField>
        </div>
      </Card>

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Create Lesson Plan" />
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="lp-topic" label="Topic" required value={formTopic} onChange={(e) => setFormTopic(e.target.value)} />
              <TextField id="lp-subtopic" label="Subtopic" value={formSubtopic} onChange={(e) => setFormSubtopic(e.target.value)} />
              <TextField id="lp-date" label="Planned Date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              <TextField id="lp-duration" label="Duration (min)" type="number" value={formDuration} onChange={(e) => setFormDuration(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Learning Objectives</label>
              <textarea rows={3} value={formObjectives} onChange={(e) => setFormObjectives(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Learning Activities</label>
              <textarea rows={3} value={formActivities} onChange={(e) => setFormActivities(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Lesson Plan'}</Button>
            </div>
          </form>
        </Card>
      )}

      {plans.length === 0 ? (
        <EmptyState title="No lesson plans" description="Create your first lesson plan above." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Topic</th>
                  <th scope="col" className="px-4 py-3">Subject</th>
                  <th scope="col" className="px-4 py-3">Class</th>
                  <th scope="col" className="px-4 py-3">Teacher</th>
                  <th scope="col" className="px-4 py-3">Planned Date</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {plans.map((p) => (
                  <tr key={p.plan_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{p.topic}</td>
                    <td className="px-4 py-2.5 text-gray-700">{p.subject_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{p.class_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{p.teacher_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.planned_date || '—'}</td>
                    <td className="px-4 py-2.5">
                      <select value={p.status} onChange={(e) => handleStatusChange(p.plan_id, e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900">
                        <option value="planned">Planned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{p.completion_pct}%</td>
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
