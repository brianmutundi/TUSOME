'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getExamSetupOptions,
  getCurriculumCoverage,
  getCurriculumCoverageSummary,
  isAbortError,
  upsertCurriculumCoverage,
} from '@/lib/analytics/api';
import type { ExamSetupOptions } from '@/lib/analytics/types';
import type { ClassOption, CurriculumCoverage, CurriculumCoverageSummary, SubjectOption } from '@/lib/analytics/types';

export default function CurriculumCoveragePage() {
  const [options, setOptions] = useState<ExamSetupOptions>({ classes: [], streams: [], subjects: [] });
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState('Term 1');
  const [year, setYear] = useState(new Date().getFullYear());
  const [coverage, setCoverage] = useState<CurriculumCoverage[]>([]);
  const [summary, setSummary] = useState<CurriculumCoverageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTopic, setFormTopic] = useState('');
  const [formSubtopic, setFormSubtopic] = useState('');
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

  const loadCoverage = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getCurriculumCoverage(subjectId || undefined, classId || undefined, term, year, { signal: controller.signal }),
      getCurriculumCoverageSummary(subjectId || undefined, classId || undefined, term, year, { signal: controller.signal }),
    ])
      .then(([c, s]) => {
        if (!active) return;
        setCoverage(c);
        setSummary(s);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load coverage.')); });
    return () => { active = false; controller.abort(); };
  }, [subjectId, classId, term, year]);

  useEffect(() => { const cleanup = loadCoverage(); return cleanup; }, [loadCoverage]);

  const handleToggleTaught = async (c: CurriculumCoverage) => {
    try {
      await upsertCurriculumCoverage(c.subject_id, c.term, c.academic_year, c.curriculum_topic, c.class_id ?? undefined, c.curriculum_subtopic ?? undefined, c.is_planned, !c.is_taught, !c.is_taught ? new Date().toISOString().split('T')[0] : undefined);
      loadCoverage();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not update coverage.'));
    }
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTopic.trim() || !subjectId) { setActionError('Subject and topic are required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertCurriculumCoverage(subjectId, term, year, formTopic.trim(), classId || undefined, formSubtopic.trim() || undefined, true, false);
      setActionSuccess('Topic added.');
      setShowForm(false);
      setFormTopic(''); setFormSubtopic('');
      loadCoverage();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not add topic.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading curriculum coverage…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load curriculum coverage">{error}</Alert>
      </main>
    );
  }

  const subjects = (options as any).subjects || [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Curriculum Coverage
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Curriculum Coverage</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">Track curriculum coverage by subject, class, and term.</p>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Topic'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Add Curriculum Topic" />
          <form onSubmit={handleAddTopic} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="cc-topic" label="Topic" required value={formTopic} onChange={(e) => setFormTopic(e.target.value)} />
              <TextField id="cc-subtopic" label="Subtopic" value={formSubtopic} onChange={(e) => setFormSubtopic(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Topic'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="mb-6">
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField id="cc-subject" label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s: SubjectOption) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </SelectField>
          <SelectField id="cc-class" label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {options.classes.map((c: ClassOption) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </SelectField>
          <SelectField id="cc-term" label="Term" value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="Term 1">Term 1</option>
            <option value="Term 2">Term 2</option>
            <option value="Term 3">Term 3</option>
          </SelectField>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Year</label>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
          </div>
        </div>
      </Card>

      {/* Summary */}
      {summary.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summary.map((s) => (
            <Card key={s.subject_id + (s.class_id || '')}>
              <div className="p-5">
                <p className="text-sm font-medium text-gray-900">{s.subject_name} {s.class_name ? `· ${s.class_name}` : ''}</p>
                <p className="mt-2 text-2xl font-bold text-blue-700">{s.coverage_pct}%</p>
                <p className="text-xs text-gray-500">{s.taught_topics}/{s.total_topics} topics taught</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {coverage.length === 0 ? (
        <EmptyState title="No curriculum coverage" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Topic</th>
                  <th scope="col" className="px-4 py-3">Subtopic</th>
                  <th scope="col" className="px-4 py-3">Planned</th>
                  <th scope="col" className="px-4 py-3">Taught</th>
                  <th scope="col" className="px-4 py-3">Taught Date</th>
                  <th scope="col" className="px-4 py-3">Taught By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {coverage.map((c) => (
                  <tr key={c.coverage_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{c.curriculum_topic}</td>
                    <td className="px-4 py-2.5 text-gray-700">{c.curriculum_subtopic || '—'}</td>
                    <td className="px-4 py-2.5">{c.is_planned ? '✓' : '—'}</td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => handleToggleTaught(c)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          c.is_taught ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {c.is_taught ? 'Taught ✓' : 'Not Taught'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{c.taught_date || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{c.taught_by_name || '—'}</td>
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
