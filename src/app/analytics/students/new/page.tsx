'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, CardHeader, SelectField, TextField } from '@/components/ui';
import { createStudent, describeAnalyticsError, getAnalyticsFilters, getTransportRoutes, saveStudentResidenceTransport } from '@/lib/analytics/api';
import type { AnalyticsFilterOptions } from '@/lib/analytics/api';
import type { TransportRoute, StudentResidenceType, StudentTransportMode } from '@/lib/analytics/types';

const EMPTY: AnalyticsFilterOptions = { exams: [], classes: [], streams: [] };

export default function AddStudentPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<AnalyticsFilterOptions>(EMPTY);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [admissionNo, setAdmissionNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('');
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [residence, setResidence] = useState<StudentResidenceType>('day_scholar');
  const [transport, setTransport] = useState<StudentTransportMode>('school_transport');
  const [routeId, setRouteId] = useState('');
  const [otherDetails, setOtherDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getAnalyticsFilters(), getTransportRoutes()])
      .then(([f, r]) => { if (active) { setFilters(f); setRoutes(r.filter((route) => route.is_active)); } })
      .catch((e) => { if (active) setError(describeAnalyticsError(e, 'Could not load classes and configured transport routes.')); });
    return () => { active = false; };
  }, []);

  const streams = classId ? filters.streams.filter((s) => s.class_id === classId) : [];
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!admissionNo.trim() || !fullName.trim()) { setError('Admission number and full name are required.'); return; }
    if (residence === 'day_scholar' && transport === 'school_transport' && !routeId) { setError('Select an existing active school transport route.'); return; }
    if (residence === 'day_scholar' && transport === 'other' && !otherDetails.trim()) { setError('Enter the other transport details.'); return; }
    setSaving(true);
    let studentId: string | null = null;
    try {
      studentId = await createStudent(admissionNo.trim(), fullName.trim(), gender || undefined, classId || undefined, streamId || undefined);
      await saveStudentResidenceTransport(studentId, residence,
        residence === 'boarder' ? null : transport,
        residence === 'day_scholar' && transport === 'school_transport' ? routeId : null,
        residence === 'day_scholar' && transport === 'other' ? otherDetails.trim() : null);
      router.push(`/analytics/students/${encodeURIComponent(studentId)}`);
    } catch (e) {
      setError(studentId
        ? 'The student record was created, but residence/transport details could not be saved. Open the profile and retry the residence fields. ' + describeAnalyticsError(e, 'Save failed.')
        : describeAnalyticsError(e, 'Could not create student.'));
    } finally {
      setSaving(false);
    }
  };

  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500"><Link href="/analytics/students" className="text-blue-700 hover:underline">Student Directory</Link> / Add Student</p>
    <h1 className="mb-5 text-2xl font-bold text-gray-900">Add Student</h1>
    {error && <div className="mb-4"><Alert tone="error" title="Could not complete student setup">{error}</Alert></div>}
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card><CardHeader title="Student Details" /><div className="grid gap-4 p-5 sm:grid-cols-2">
        <TextField id="admission-no" label="Admission Number" required value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} />
        <TextField id="full-name" label="Full Name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <SelectField id="gender" label="Gender" value={gender} onChange={(e) => setGender(e.target.value)}><option value="">Not specified</option><option value="Male">Male</option><option value="Female">Female</option></SelectField>
        <SelectField id="class" label="Class / Grade" value={classId} onChange={(e) => { setClassId(e.target.value); setStreamId(''); }}><option value="">Select class</option>{filters.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectField>
        <SelectField id="stream" label="Stream" value={streamId} onChange={(e) => setStreamId(e.target.value)}><option value="">No stream</option>{streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</SelectField>
      </div></Card>
      <Card><CardHeader title="Residence / Boarding Status" /><div className="space-y-4 p-5">
        <SelectField id="residence-type" label="Residence" value={residence} onChange={(e) => { const v = e.target.value as StudentResidenceType; setResidence(v); if (v === 'boarder') { setRouteId(''); setOtherDetails(''); } }}><option value="day_scholar">Day Scholar</option><option value="boarder">Boarder</option></SelectField>
        {residence === 'day_scholar' && <>
          <SelectField id="transport-mode" label="Means of Transport" value={transport} onChange={(e) => { const v = e.target.value as StudentTransportMode; setTransport(v); setRouteId(''); setOtherDetails(''); }}><option value="school_transport">School Transport</option><option value="parent_guardian">Parent / Guardian</option><option value="public_transport">Public Transport</option><option value="walking">Walking</option><option value="other">Other</option></SelectField>
          {transport === 'school_transport' && <SelectField id="transport-route" label="Configured Transport Route" required value={routeId} onChange={(e) => setRouteId(e.target.value)}><option value="">Select existing route</option>{routes.map((r) => <option key={r.route_id} value={r.route_id}>{r.name}</option>)}</SelectField>}
          {transport === 'other' && <TextField id="other-transport" label="Other Transport Details" required value={otherDetails} onChange={(e) => setOtherDetails(e.target.value)} />}
          {transport === 'school_transport' && routes.length === 0 && <p className="text-sm text-amber-700">No active routes are configured. Add a real route in Transport before assigning school transport.</p>}
        </>}
      </div></Card>
      <div className="flex gap-3"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Student'}</Button><Button type="button" variant="secondary" onClick={() => router.push('/analytics/students')}>Cancel</Button></div>
    </form>
  </main>;
}
