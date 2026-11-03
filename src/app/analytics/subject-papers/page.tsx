'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getExamSetupOptions,
  getSubjectPapers,
  isAbortError,
  upsertSubjectPaper,
} from '@/lib/analytics/api';
import type { ExamSetupOptions } from '@/lib/analytics/types';
import type { SubjectOption, SubjectPaper } from '@/lib/analytics/types';

const EMPTY_OPTIONS: ExamSetupOptions = { classes: [], streams: [], subjects: [] };

export default function SubjectPapersPage() {
  const [options, setOptions] = useState<ExamSetupOptions>(EMPTY_OPTIONS);
  const [subjectId, setSubjectId] = useState('');
  const [papers, setPapers] = useState<SubjectPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formMaxMarks, setFormMaxMarks] = useState('100');
  const [formWeight, setFormWeight] = useState('1.0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getExamSetupOptions({ signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setOptions(data);
        if (data.subjects && data.subjects.length > 0) setSubjectId(data.subjects[0].id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load filters.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  const loadPapers = useCallback(() => {
    if (!subjectId) { setPapers([]); return; }
    const controller = new AbortController();
    let active = true;
    setLoadingPapers(true);
    setActionError(null);
    getSubjectPapers(subjectId, { signal: controller.signal })
      .then((data) => { if (!active) return; setPapers(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load subject papers.')); })
      .finally(() => { if (active) setLoadingPapers(false); });
    return () => { active = false; controller.abort(); };
  }, [subjectId]);

  useEffect(() => { const cleanup = loadPapers(); return cleanup; }, [loadPapers]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId || !formName.trim()) { setActionError('Name is required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertSubjectPaper(subjectId, formName.trim(), formCode.trim() || undefined, Number(formMaxMarks) || 100, Number(formWeight) || 1.0);
      setActionSuccess('Subject paper saved.');
      setShowForm(false);
      setFormName(''); setFormCode(''); setFormMaxMarks('100'); setFormWeight('1.0');
      loadPapers();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save subject paper.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading subject papers…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load subject papers">{error}</Alert>
      </main>
    );
  }

  const subjects = (options.subjects || []) as SubjectOption[];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Subject Papers
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Subject Papers</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage subject papers (e.g., Paper 1, Paper 2) with weights and max marks.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Paper'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Saved">{actionSuccess}</Alert></div>}

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="sp-subject" label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s: SubjectOption) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </SelectField>
        </div>
      </Card>

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Add Subject Paper" />
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField id="sp-name" label="Paper Name" required placeholder="e.g. Paper 1" value={formName} onChange={(e) => setFormName(e.target.value)} />
              <TextField id="sp-code" label="Code" placeholder="e.g. P1" value={formCode} onChange={(e) => setFormCode(e.target.value)} />
              <TextField id="sp-max" label="Max Marks" type="number" value={formMaxMarks} onChange={(e) => setFormMaxMarks(e.target.value)} />
              <TextField id="sp-weight" label="Weight" type="number" step="0.1" value={formWeight} onChange={(e) => setFormWeight(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Paper'}</Button>
            </div>
          </form>
        </Card>
      )}

      {loadingPapers ? (
        <LoadingPanel label="Loading subject papers…" />
      ) : papers.length === 0 ? (
        <EmptyState title="No subject papers" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Max Marks</th>
                  <th scope="col" className="px-4 py-3">Weight</th>
                  <th scope="col" className="px-4 py-3">Sort Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {papers.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.code || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{p.max_marks}</td>
                    <td className="px-4 py-2.5 text-gray-700">{p.weight}</td>
                    <td className="px-4 py-2.5 text-gray-700">{p.sort_order}</td>
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
