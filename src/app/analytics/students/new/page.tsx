'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FieldBlock, FieldError } from '@/components/analytics/FormBits';
import { RadioCardGroup } from '@/components/overlays';
import { Alert, Button, Card, CardHeader, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  createStudent,
  describeAnalyticsError,
  getClassesWithStreams,
  isAbortError,
} from '@/lib/analytics/api';
import { isUuid } from '@/lib/analytics/guards';
import { GENDERS, hasErrors, validateNewStudent, type NewStudentInput } from '@/lib/analytics/studentForms';
import type { ClassWithStreams } from '@/lib/analytics/types';

const EMPTY: NewStudentInput & {
  classId: string;
  streamId: string;
  guardianName: string;
  guardianRelation: string;
  previousSchool: string;
} = {
  admissionNo: '',
  fullName: '',
  gender: '',
  academicYear: String(new Date().getFullYear()),
  dateOfBirth: '',
  primaryPhone: '',
  classId: '',
  streamId: '',
  guardianName: '',
  guardianRelation: '',
  previousSchool: '',
};

export default function NewStudentPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ClassWithStreams[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getClassesWithStreams({ signal: controller.signal })
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        setLoadError(describeAnalyticsError(caught, 'Could not load classes.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const classes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.class_id)) seen.set(r.class_id, r.class_name);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const streams = useMemo(
    () =>
      rows
        .filter((r) => r.class_id === form.classId && r.stream_id)
        .map((r) => ({ id: r.stream_id as string, name: r.stream_name ?? 'Stream' })),
    [rows, form.classId]
  );

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value, ...(key === 'classId' ? { streamId: '' } : {}) }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = validateNewStudent(form);
    setErrors(found);
    setSubmitError(null);
    if (hasErrors(found)) return;
    if (form.classId && !isUuid(form.classId)) {
      setSubmitError('Choose a class from the list.');
      return;
    }
    setBusy(true);
    try {
      const id = await createStudent(
        form.admissionNo.trim(),
        form.fullName.trim(),
        form.gender || undefined,
        form.classId || undefined,
        form.streamId || undefined,
        form.academicYear ? Number(form.academicYear) : undefined,
        {
          dateOfBirth: form.dateOfBirth,
          guardianName: form.guardianName.trim(),
          guardianRelation: form.guardianRelation.trim(),
          primaryPhone: form.primaryPhone.trim(),
          previousSchool: form.previousSchool.trim(),
        }
      );
      router.push(`/analytics/students/${encodeURIComponent(id)}`);
    } catch (caught) {
      console.error('[analytics] failed to create student');
      setSubmitError(describeAnalyticsError(caught, 'Could not add the student.'));
      setBusy(false);
    }
  }

  const err = (k: string) => errors[k];
  const describe = (k: string) => (errors[k] ? `new-student-${k}-error` : undefined);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        <Link href="/analytics" className="text-blue-700 hover:underline">
          Analytics
        </Link>{' '}
        /{' '}
        <Link href="/analytics/students" className="text-blue-700 hover:underline">
          Student Directory
        </Link>{' '}
        / New student
      </p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Add a student</h1>
      <p className="mt-1 text-sm text-gray-600">
        Admission number and full name are required. Everything else can be added later from the
        student&apos;s profile.
      </p>

      {loading ? (
        <div className="mt-6">
          <LoadingPanel label="Loading classes…" />
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-6">
          {loadError && (
            <Alert tone="warning" title="Classes did not load">
              {loadError} You can still add the student and place them in a class later.
            </Alert>
          )}
          {submitError && <Alert tone="error" title="Student was not added">{submitError}</Alert>}

          <Card>
            <CardHeader title="Identity" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <FieldBlock>
                <TextField
                  id="new-student-admissionNo"
                  label="Admission number *"
                  value={form.admissionNo}
                  onChange={(e) => set('admissionNo', e.target.value)}
                  aria-invalid={err('admissionNo') ? true : undefined}
                  aria-describedby={describe('admissionNo')}
                  autoComplete="off"
                  disabled={busy}
                />
                <FieldError id="new-student-admissionNo-error" message={err('admissionNo')} />
              </FieldBlock>
              <FieldBlock>
                <TextField
                  id="new-student-fullName"
                  label="Full name *"
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  aria-invalid={err('fullName') ? true : undefined}
                  aria-describedby={describe('fullName')}
                  autoComplete="off"
                  disabled={busy}
                />
                <FieldError id="new-student-fullName-error" message={err('fullName')} />
              </FieldBlock>
              <div className="sm:col-span-2">
                <RadioCardGroup
                  legend="Gender"
                  name="new-student-gender"
                  value={form.gender}
                  onChange={(v) => set('gender', v)}
                  options={GENDERS.map((g) => ({ value: g, label: g }))}
                />
                <FieldError id="new-student-gender-error" message={err('gender')} />
              </div>
              <FieldBlock>
                <TextField
                  id="new-student-dateOfBirth"
                  label="Date of birth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => set('dateOfBirth', e.target.value)}
                  aria-invalid={err('dateOfBirth') ? true : undefined}
                  aria-describedby={describe('dateOfBirth')}
                  disabled={busy}
                />
                <FieldError id="new-student-dateOfBirth-error" message={err('dateOfBirth')} />
              </FieldBlock>
              <FieldBlock>
                <TextField
                  id="new-student-previousSchool"
                  label="Previous school"
                  value={form.previousSchool}
                  onChange={(e) => set('previousSchool', e.target.value)}
                  disabled={busy}
                />
              </FieldBlock>
            </div>
          </Card>

          <Card>
            <CardHeader title="Placement" />
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <SelectField
                id="new-student-classId"
                label="Class"
                value={form.classId}
                onChange={(e) => set('classId', e.target.value)}
                disabled={busy || classes.length === 0}
              >
                <option value="">Not placed yet</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="new-student-streamId"
                label="Stream"
                value={form.streamId}
                onChange={(e) => set('streamId', e.target.value)}
                disabled={busy || streams.length === 0}
              >
                <option value="">{form.classId && streams.length === 0 ? 'No streams' : 'No stream'}</option>
                {streams.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectField>
              <FieldBlock>
                <TextField
                  id="new-student-academicYear"
                  label="Academic year"
                  inputMode="numeric"
                  value={form.academicYear}
                  onChange={(e) => set('academicYear', e.target.value)}
                  aria-invalid={err('academicYear') ? true : undefined}
                  aria-describedby={describe('academicYear')}
                  disabled={busy}
                />
                <FieldError id="new-student-academicYear-error" message={err('academicYear')} />
              </FieldBlock>
            </div>
          </Card>

          <Card>
            <CardHeader title="Guardian" />
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <TextField
                id="new-student-guardianName"
                label="Guardian name"
                value={form.guardianName}
                onChange={(e) => set('guardianName', e.target.value)}
                disabled={busy}
              />
              <TextField
                id="new-student-guardianRelation"
                label="Relationship"
                value={form.guardianRelation}
                onChange={(e) => set('guardianRelation', e.target.value)}
                disabled={busy}
              />
              <FieldBlock>
                <TextField
                  id="new-student-primaryPhone"
                  label="Phone"
                  type="tel"
                  inputMode="tel"
                  value={form.primaryPhone}
                  onChange={(e) => set('primaryPhone', e.target.value)}
                  aria-invalid={err('primaryPhone') ? true : undefined}
                  aria-describedby={describe('primaryPhone')}
                  disabled={busy}
                />
                <FieldError id="new-student-primaryPhone-error" message={err('primaryPhone')} />
              </FieldBlock>
            </div>
          </Card>

          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href="/analytics/students"
              className="inline-flex min-h-[2.75rem] items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <Button type="submit" disabled={busy}>
              {busy ? 'Adding…' : 'Add student'}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
