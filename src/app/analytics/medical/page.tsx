'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  createMedicalVisit,
  describeAnalyticsError,
  getMedicalVisits,
  getStudentDirectory,
  isAbortError,
} from '@/lib/analytics/api';
import type { MedicalVisit, StudentDirectoryRow } from '@/lib/analytics/types';

export default function MedicalPage() {
  const [visits, setVisits] = useState<MedicalVisit[]>([]);
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formComplaint, setFormComplaint] = useState('');
  const [formDiagnosis, setFormDiagnosis] = useState('');
  const [formTreatment, setFormTreatment] = useState('');
  const [formReferred, setFormReferred] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getMedicalVisits(studentId || undefined, { signal: controller.signal }),
      getStudentDirectory(undefined, undefined, undefined, undefined, { signal: controller.signal }),
    ])
      .then(([v, s]) => {
        if (!active) return;
        setVisits(v);
        setStudents(s);
        if (s.length > 0 && !studentId) setStudentId(s[0].student_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load medical data.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [studentId]);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createMedicalVisit(studentId || undefined, formComplaint.trim() || undefined, formDiagnosis.trim() || undefined, formTreatment.trim() || undefined, formReferred.trim() || undefined);
      setActionSuccess('Medical visit recorded.');
      setShowForm(false);
      setFormComplaint(''); setFormDiagnosis(''); setFormTreatment(''); setFormReferred('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not record visit.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading medical…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load medical">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Medical
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Medical</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage student medical visits and inventory.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ New Visit'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="med-student" label="Filter by Student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">All Students</option>
            {students.map((s) => (<option key={s.student_id} value={s.student_id}>{s.full_name || s.admission_no}</option>))}
          </SelectField>
        </div>
      </Card>

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="New Medical Visit" />
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="med-complaint" label="Complaint" value={formComplaint} onChange={(e) => setFormComplaint(e.target.value)} />
              <TextField id="med-diagnosis" label="Diagnosis" value={formDiagnosis} onChange={(e) => setFormDiagnosis(e.target.value)} />
              <TextField id="med-treatment" label="Treatment" value={formTreatment} onChange={(e) => setFormTreatment(e.target.value)} />
              <TextField id="med-referred" label="Referred To" value={formReferred} onChange={(e) => setFormReferred(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record Visit'}</Button>
            </div>
          </form>
        </Card>
      )}

      {visits.length === 0 ? (
        <EmptyState title="No medical visits" description="Record your first visit above." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Student</th>
                  <th scope="col" className="px-4 py-3">Complaint</th>
                  <th scope="col" className="px-4 py-3">Diagnosis</th>
                  <th scope="col" className="px-4 py-3">Treatment</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {visits.map((v) => (
                  <tr key={v.visit_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs text-gray-600">{new Date(v.visit_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{v.student_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{v.complaint || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{v.diagnosis || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{v.treatment || '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={v.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}>{v.status}</Badge>
                    </td>
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
