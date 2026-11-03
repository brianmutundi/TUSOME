'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { FieldBlock, FieldError } from '@/components/analytics/FormBits';
import { SectionBody, useSection } from '@/components/analytics/Section';
import { ConfirmDialog, Modal } from '@/components/overlays';
import { Alert, Badge, Button, Card, CardHeader, SelectField, TextField } from '@/components/ui';
import {
  deleteStaffGroup,
  deleteTeacherAllocation,
  describeAnalyticsError,
  getClassesWithStreams,
  getStaffGroups,
  getSubjectsWithDetails,
  getTeacherAllocations,
  getTeacherDirectory,
  upsertStaffGroup,
  upsertTeacherAllocation,
  upsertTeacherProfile,
} from '@/lib/analytics/api';
import { hasErrors } from '@/lib/analytics/studentForms';
import {
  ALLOCATION_TYPES,
  allocationLabel,
  validateAllocation,
  validateGroupName,
  validateTeacher,
} from '@/lib/analytics/teacherForms';
import type {
  ClassWithStreams,
  StaffGroupRow,
  SubjectWithDetails,
  TeacherAllocationRow,
  TeacherDirectoryRow,
} from '@/lib/analytics/types';

type Tab = 'teachers' | 'assignments' | 'groups';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'teachers', label: 'Teachers' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'groups', label: 'Groups' },
];

export default function TeachersPage() {
  const [tab, setTab] = useState<Tab>('teachers');
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        <Link href="/analytics" className="text-blue-700 hover:underline">
          Analytics
        </Link>{' '}
        / Teachers
      </p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Teachers</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">
        Manage teacher accounts, who teaches which subject and class, and staff groups.
      </p>

      <div role="tablist" aria-label="Teacher management" className="mt-6 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            type="button"
            onClick={() => {
              setTab(t.id);
              setNotice(null);
            }}
            className={`-mb-px min-h-[2.75rem] border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
              tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mt-4">
          <Alert tone="success" title={notice} />
        </div>
      )}

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6">
        {tab === 'teachers' && <TeachersPanel onSaved={setNotice} />}
        {tab === 'assignments' && <AssignmentsPanel onSaved={setNotice} />}
        {tab === 'groups' && <GroupsPanel onSaved={setNotice} />}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Teachers                                                            */
/* ------------------------------------------------------------------ */

const EMPTY_TEACHER = { fullName: '', email: '', phone: '', initials: '', tscNumber: '', employeeNumber: '', gender: '' };

function TeachersPanel({ onSaved }: { onSaved: (m: string) => void }) {
  const state = useSection<TeacherDirectoryRow[]>((signal) => getTeacherDirectory({ signal }), 'Could not load teachers.');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ id?: string; groups: string[]; active: boolean } | null>(null);
  const [form, setForm] = useState(EMPTY_TEACHER);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = state.data ?? [];
    if (!q) return rows;
    return rows.filter((t) =>
      [t.full_name, t.email, t.initials, t.tsc_number, t.employee_number].some((v) => v?.toLowerCase().includes(q))
    );
  }, [state.data, query]);

  function open(t?: TeacherDirectoryRow) {
    setForm(
      t
        ? {
            fullName: t.full_name ?? '',
            email: t.email ?? '',
            phone: t.phone ?? '',
            initials: t.initials ?? '',
            tscNumber: t.tsc_number ?? '',
            employeeNumber: t.employee_number ?? '',
            gender: t.gender ?? '',
          }
        : EMPTY_TEACHER
    );
    setErrors({});
    setSubmitError(null);
    // Saving replaces group memberships, so an edit must send the groups the teacher already has.
    setEditing({ id: t?.account_id, groups: t?.group_names ?? [], active: t?.is_active ?? true });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !editing) return;
    const found = validateTeacher(form);
    setErrors(found);
    if (hasErrors(found)) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await upsertTeacherProfile({
        userId: editing.id,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        initials: form.initials.trim() || undefined,
        tscNumber: form.tscNumber.trim() || undefined,
        employeeNumber: form.employeeNumber.trim() || undefined,
        gender: form.gender || undefined,
        groupNames: editing.groups,
        isActive: editing.active,
      });
      setEditing(null);
      onSaved(editing.id ? 'Teacher updated.' : 'Teacher added.');
      state.reload();
    } catch (caught) {
      setSubmitError(describeAnalyticsError(caught, 'Could not save the teacher.'));
    } finally {
      setBusy(false);
    }
  }

  const bind = (key: keyof typeof EMPTY_TEACHER) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm((p) => ({ ...p, [key]: e.target.value })),
    'aria-invalid': errors[key] ? (true as const) : undefined,
    'aria-describedby': errors[key] ? `teacher-${key}-error` : undefined,
  });

  return (
    <Card>
      <CardHeader
        title="Teacher directory"
        action={<Button onClick={() => open()}>Add teacher</Button>}
      />
      <div className="border-b border-gray-100 p-4">
        <TextField
          id="teacher-search"
          label="Search"
          type="search"
          placeholder="Name, email, initials or TSC number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <SectionBody
        state={{ ...state, data: state.data ? filtered : null }}
        empty={{ title: query ? 'No teachers match' : 'No teachers yet', description: query ? 'Try a different search.' : 'Add the first teacher account.' }}
      >
        {(rows) => (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Teacher</th>
                  <th scope="col" className="px-4 py-3">Contact</th>
                  <th scope="col" className="px-4 py-3">Teaching</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((t) => (
                  <tr key={t.account_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{t.full_name ?? 'Unnamed'}</p>
                      <p className="text-xs text-gray-500">
                        {[t.initials, t.tsc_number && `TSC ${t.tsc_number}`].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <p>{t.email ?? '—'}</p>
                      <p className="text-xs text-gray-500">{t.phone ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <p>
                        {t.subject_assignments_count} subject{t.subject_assignments_count === 1 ? '' : 's'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {[...t.class_teacher_labels.map((l) => `Class teacher: ${l}`), ...t.supervisor_labels.map((l) => `Supervisor: ${l}`)].join(' · ')}
                      </p>
                      {t.group_names.length > 0 && <p className="text-xs text-gray-500">{t.group_names.join(', ')}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {t.access_revoked ? (
                        <Badge className="border-red-300 bg-red-50 text-red-800">Access revoked</Badge>
                      ) : t.is_active ? (
                        <Badge className="border-emerald-300 bg-emerald-50 text-emerald-800">Active</Badge>
                      ) : (
                        <Badge className="border-gray-300 bg-gray-50 text-gray-600">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => open(t)} aria-label={`Edit ${t.full_name ?? 'teacher'}`}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionBody>

      <Modal
        open={editing !== null}
        onClose={busy ? () => undefined : () => setEditing(null)}
        title={editing?.id ? 'Edit teacher' : 'Add teacher'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="teacher-form" disabled={busy}>
              {busy ? 'Saving…' : 'Save teacher'}
            </Button>
          </>
        }
      >
        <form id="teacher-form" onSubmit={submit} noValidate className="space-y-4">
          {submitError && <Alert tone="error" title="Teacher not saved">{submitError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <TextField id="teacher-fullName" label="Full name *" {...bind('fullName')} />
              <FieldError id="teacher-fullName-error" message={errors.fullName} />
            </FieldBlock>
            <FieldBlock>
              <TextField id="teacher-email" label="Email *" type="email" {...bind('email')} />
              <FieldError id="teacher-email-error" message={errors.email} />
            </FieldBlock>
            <FieldBlock>
              <TextField id="teacher-phone" label="Phone" type="tel" inputMode="tel" {...bind('phone')} />
              <FieldError id="teacher-phone-error" message={errors.phone} />
            </FieldBlock>
            <FieldBlock>
              <TextField id="teacher-initials" label="Initials" {...bind('initials')} />
              <FieldError id="teacher-initials-error" message={errors.initials} />
            </FieldBlock>
            <TextField id="teacher-tscNumber" label="TSC number" {...bind('tscNumber')} />
            <TextField id="teacher-employeeNumber" label="Employee number" {...bind('employeeNumber')} />
            <SelectField
              id="teacher-gender"
              label="Gender"
              value={form.gender}
              onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
            >
              <option value="">Not stated</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </SelectField>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Assignments                                                         */
/* ------------------------------------------------------------------ */

function AssignmentsPanel({ onSaved }: { onSaved: (m: string) => void }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [typeFilter, setTypeFilter] = useState('');
  const teachers = useSection<TeacherDirectoryRow[]>((s) => getTeacherDirectory({ signal: s }), 'Could not load teachers.');
  const classes = useSection<ClassWithStreams[]>((s) => getClassesWithStreams({ signal: s }), 'Could not load classes.');
  const subjects = useSection<SubjectWithDetails[]>((s) => getSubjectsWithDetails({ signal: s }), 'Could not load subjects.');
  const allocations = useSection<TeacherAllocationRow[]>(
    (s) => getTeacherAllocations(year, { signal: s }),
    'Could not load assignments.',
    [year]
  );

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ allocationType: 'SUBJECT_TEACHER', classId: '', streamId: '', subjectId: '', teacherId: '' });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toRemove, setToRemove] = useState<TeacherAllocationRow | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const classOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of classes.data ?? []) if (!seen.has(r.class_id)) seen.set(r.class_id, r.class_name);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [classes.data]);
  const streamOptions = useMemo(
    () => (classes.data ?? []).filter((r) => r.class_id === form.classId && r.stream_id),
    [classes.data, form.classId]
  );

  const visible = useMemo(
    () => (allocations.data ?? []).filter((a) => !typeFilter || a.allocation_type === typeFilter),
    [allocations.data, typeFilter]
  );

  function open() {
    setForm({ allocationType: 'SUBJECT_TEACHER', classId: '', streamId: '', subjectId: '', teacherId: '' });
    setErrors({});
    setSubmitError(null);
    setAdding(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = validateAllocation({ ...form, academicYear: String(year) });
    setErrors(found);
    if (hasErrors(found)) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await upsertTeacherAllocation({
        allocationType: form.allocationType as TeacherAllocationRow['allocation_type'],
        classId: form.classId,
        streamId: form.streamId || null,
        subjectId: form.allocationType === 'SUBJECT_TEACHER' ? form.subjectId : null,
        teacherId: form.teacherId,
        academicYear: year,
      });
      setAdding(false);
      onSaved('Assignment saved.');
      allocations.reload();
      teachers.reload();
    } catch (caught) {
      setSubmitError(describeAnalyticsError(caught, 'Could not save the assignment.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!toRemove || busy) return;
    setBusy(true);
    setRemoveError(null);
    try {
      await deleteTeacherAllocation(toRemove.allocation_type, toRemove.allocation_id);
      setToRemove(null);
      onSaved('Assignment removed.');
      allocations.reload();
      teachers.reload();
    } catch (caught) {
      setRemoveError(describeAnalyticsError(caught, 'Could not remove the assignment.'));
    } finally {
      setBusy(false);
    }
  }

  const years = [thisYear + 1, thisYear, thisYear - 1, thisYear - 2];
  const err = (k: string) => errors[k];

  return (
    <Card>
      <CardHeader
        title="Who teaches what"
        action={<Button onClick={open}>Add assignment</Button>}
      />
      <div className="flex flex-wrap gap-4 border-b border-gray-100 p-4">
        <SelectField id="assign-year" label="Academic year" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </SelectField>
        <SelectField id="assign-type-filter" label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {ALLOCATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectField>
      </div>
      <SectionBody
        state={{ ...allocations, data: allocations.data ? visible : null }}
        empty={{ title: 'No assignments', description: `Nothing is assigned for ${year} yet.` }}
      >
        {(rows) => (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Teacher</th>
                  <th scope="col" className="px-4 py-3">Role</th>
                  <th scope="col" className="px-4 py-3">Class</th>
                  <th scope="col" className="px-4 py-3">Subject</th>
                  <th scope="col" className="px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((a) => (
                  <tr key={`${a.allocation_type}-${a.allocation_id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.teacher_name ?? 'Unnamed'}</td>
                    <td className="px-4 py-3 text-gray-700">{allocationLabel(a.allocation_type)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {a.class_name}
                      {a.stream_name ? ` ${a.stream_name}` : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{a.subject_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRemoveError(null);
                          setToRemove(a);
                        }}
                        aria-label={`Remove ${allocationLabel(a.allocation_type)} assignment for ${a.teacher_name ?? 'teacher'}`}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionBody>

      <Modal
        open={adding}
        onClose={busy ? () => undefined : () => setAdding(false)}
        title="Add assignment"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="allocation-form" disabled={busy}>
              {busy ? 'Saving…' : 'Save assignment'}
            </Button>
          </>
        }
      >
        <form id="allocation-form" onSubmit={submit} noValidate className="space-y-4">
          {submitError && <Alert tone="error" title="Assignment not saved">{submitError}</Alert>}
          <SelectField
            id="alloc-type"
            label="Type"
            value={form.allocationType}
            onChange={(e) => setForm((p) => ({ ...p, allocationType: e.target.value }))}
          >
            {ALLOCATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectField>
          <FieldBlock>
            <SelectField
              id="alloc-teacher"
              label="Teacher *"
              value={form.teacherId}
              onChange={(e) => setForm((p) => ({ ...p, teacherId: e.target.value }))}
              aria-invalid={err('teacherId') ? true : undefined}
              aria-describedby={err('teacherId') ? 'alloc-teacher-error' : undefined}
            >
              <option value="">Choose…</option>
              {(teachers.data ?? [])
                .filter((t) => t.is_active && !t.access_revoked)
                .map((t) => (
                  <option key={t.account_id} value={t.account_id}>
                    {t.full_name ?? t.email}
                  </option>
                ))}
            </SelectField>
            <FieldError id="alloc-teacher-error" message={err('teacherId')} />
          </FieldBlock>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <SelectField
                id="alloc-class"
                label="Class *"
                value={form.classId}
                onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value, streamId: '' }))}
                aria-invalid={err('classId') ? true : undefined}
                aria-describedby={err('classId') ? 'alloc-class-error' : undefined}
              >
                <option value="">Choose…</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              <FieldError id="alloc-class-error" message={err('classId')} />
            </FieldBlock>
            <SelectField
              id="alloc-stream"
              label="Stream"
              value={form.streamId}
              onChange={(e) => setForm((p) => ({ ...p, streamId: e.target.value }))}
              disabled={streamOptions.length === 0}
            >
              <option value="">Whole class</option>
              {streamOptions.map((s) => (
                <option key={s.stream_id as string} value={s.stream_id as string}>
                  {s.stream_name}
                </option>
              ))}
            </SelectField>
          </div>
          {form.allocationType === 'SUBJECT_TEACHER' && (
            <FieldBlock>
              <SelectField
                id="alloc-subject"
                label="Subject *"
                value={form.subjectId}
                onChange={(e) => setForm((p) => ({ ...p, subjectId: e.target.value }))}
                aria-invalid={err('subjectId') ? true : undefined}
                aria-describedby={err('subjectId') ? 'alloc-subject-error' : undefined}
              >
                <option value="">Choose…</option>
                {(subjects.data ?? []).map((s) => (
                  <option key={s.subject_id} value={s.subject_id}>
                    {s.subject_name}
                  </option>
                ))}
              </SelectField>
              <FieldError id="alloc-subject-error" message={err('subjectId')} />
            </FieldBlock>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={toRemove !== null}
        title="Remove this assignment?"

        confirmLabel="Remove"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToRemove(null)}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Groups                                                              */
/* ------------------------------------------------------------------ */

function GroupsPanel({ onSaved }: { onSaved: (m: string) => void }) {
  const state = useSection<StaffGroupRow[]>((s) => getStaffGroups({ signal: s }), 'Could not load groups.');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<StaffGroupRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = validateGroupName(name, (state.data ?? []).filter((g) => g.staff_type === 'TEACHER').map((g) => g.name));
    setNameError(found);
    if (found) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await upsertStaffGroup(name.trim(), 'TEACHER');
      setAdding(false);
      setName('');
      onSaved('Group added.');
      state.reload();
    } catch (caught) {
      setSubmitError(describeAnalyticsError(caught, 'Could not save the group.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!toDelete || busy) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteStaffGroup(toDelete.group_id);
      setToDelete(null);
      onSaved('Group deleted.');
      state.reload();
    } catch (caught) {
      setDeleteError(describeAnalyticsError(caught, 'Could not delete the group.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Staff groups"
        action={
          <Button
            onClick={() => {
              setName('');
              setNameError(undefined);
              setSubmitError(null);
              setAdding(true);
            }}
          >
            Add group
          </Button>
        }
      />
      <SectionBody state={state} empty={{ title: 'No groups yet', description: 'Create a group such as Sciences or Languages.' }}>
        {(rows) => (
          <ul className="divide-y divide-gray-100">
            {rows.map((g) => (
              <li key={g.group_id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-medium text-gray-900">{g.name}</p>
                  <p className="text-xs text-gray-500">
                    {g.member_count} member{g.member_count === 1 ? '' : 's'} · {g.staff_type.toLowerCase()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeleteError(null);
                    setToDelete(g);
                  }}
                  aria-label={`Delete group ${g.name}`}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionBody>

      <Modal
        open={adding}
        onClose={busy ? () => undefined : () => setAdding(false)}
        title="Add group"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="group-form" disabled={busy}>
              {busy ? 'Saving…' : 'Add group'}
            </Button>
          </>
        }
      >
        <form id="group-form" onSubmit={submit} noValidate className="space-y-4">
          {submitError && <Alert tone="error" title="Group not saved">{submitError}</Alert>}
          <FieldBlock>
            <TextField
              id="group-name"
              label="Group name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'group-name-error' : undefined}
              autoComplete="off"
            />
            <FieldError id="group-name-error" message={nameError} />
          </FieldBlock>
        </form>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this group?"

        confirmLabel="Delete group"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </Card>
  );
}
