'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FieldBlock, FieldError, TextAreaField } from '@/components/analytics/FormBits';
import { SectionBody, useSection } from '@/components/analytics/Section';
import { ConfirmDialog, Modal, RadioCardGroup } from '@/components/overlays';
import { Alert, Badge, Button, Card, CardHeader, SelectField, TextField } from '@/components/ui';
import {
  addStudentNote,
  assignStudentResidence,
  assignStudentToGroup,
  deleteStudentNote,
  describeAnalyticsError,
  getClassesWithStreams,
  getEmergencyContacts,
  getMedicalAlerts,
  getStudentGroups,
  getStudentMemberships,
  getStudentNotes,
  getStudentResidences,
  isAbortError,
  updateStudentProfile,
  upsertEmergencyContact,
  upsertMedicalAlert,
} from '@/lib/analytics/api';
import {
  ALERT_SEVERITIES,
  ALERT_TYPES,
  GENDERS,
  NOTE_TYPES,
  hasErrors,
  labelise,
  validateEmergencyContact,
  validateMedicalAlert,
  validateNote,
} from '@/lib/analytics/studentForms';
import type {
  ClassWithStreams,
  EmergencyContact,
  MedicalAlert,
  StudentGroup,
  StudentMembership,
  StudentNote,
  StudentProfileData,
  StudentResidence,
} from '@/lib/analytics/types';

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'border-red-300 bg-red-50 text-red-800',
  high: 'border-orange-300 bg-orange-50 text-orange-800',
  medium: 'border-amber-300 bg-amber-50 text-amber-900',
  low: 'border-gray-300 bg-gray-50 text-gray-700',
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Wraps submit/cancel so each modal form guards against double submits. */
function FormFooter({
  busy,
  onCancel,
  submitLabel,
  formId,
}: {
  busy: boolean;
  onCancel: () => void;
  submitLabel: string;
  formId: string;
}) {
  return (
    <>
      <Button variant="secondary" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button type="submit" form={formId} disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </Button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* edit details                                                        */
/* ------------------------------------------------------------------ */

export function EditStudentModal({
  open,
  profile,
  onClose,
  onSaved,
}: {
  open: boolean;
  profile: StudentProfileData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<ClassWithStreams[]>([]);
  const [admissionNo, setAdmissionNo] = useState(profile.admission_no);
  const [fullName, setFullName] = useState(profile.full_name ?? '');
  const [gender, setGender] = useState(profile.gender ?? '');
  const [classId, setClassId] = useState(profile.class_id ?? '');
  const [streamId, setStreamId] = useState(profile.stream_id ?? '');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAdmissionNo(profile.admission_no);
    setFullName(profile.full_name ?? '');
    setGender(profile.gender ?? '');
    setClassId(profile.class_id ?? '');
    setStreamId(profile.stream_id ?? '');
    setErrors({});
    setSubmitError(null);
    const controller = new AbortController();
    getClassesWithStreams({ signal: controller.signal })
      .then(setRows)
      .catch((caught) => {
        if (!isAbortError(caught)) setSubmitError(describeAnalyticsError(caught, 'Could not load classes.'));
      });
    return () => controller.abort();
  }, [open, profile]);

  const classes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.class_id)) seen.set(r.class_id, r.class_name);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);
  const streams = useMemo(
    () => rows.filter((r) => r.class_id === classId && r.stream_id),
    [rows, classId]
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found: Record<string, string | undefined> = {};
    if (!admissionNo.trim()) found.admissionNo = 'Admission number is required.';
    if (!fullName.trim()) found.fullName = 'Full name is required.';
    setErrors(found);
    if (hasErrors(found)) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await updateStudentProfile(
        profile.student_id,
        admissionNo.trim(),
        fullName.trim(),
        gender || undefined,
        classId || undefined,
        streamId || undefined
      );
      onSaved();
      onClose();
    } catch (caught) {
      setSubmitError(describeAnalyticsError(caught, 'Could not save changes.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Edit student details"
      footer={<FormFooter busy={busy} onCancel={onClose} submitLabel="Save changes" formId="edit-student-form" />}
    >
      <form id="edit-student-form" onSubmit={submit} noValidate className="space-y-4">
        {submitError && <Alert tone="error" title="Not saved">{submitError}</Alert>}
        <FieldBlock>
          <TextField
            id="edit-student-admission"
            label="Admission number *"
            value={admissionNo}
            onChange={(e) => setAdmissionNo(e.target.value)}
            aria-invalid={errors.admissionNo ? true : undefined}
            aria-describedby={errors.admissionNo ? 'edit-student-admission-error' : undefined}
          />
          <FieldError id="edit-student-admission-error" message={errors.admissionNo} />
        </FieldBlock>
        <FieldBlock>
          <TextField
            id="edit-student-name"
            label="Full name *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-invalid={errors.fullName ? true : undefined}
            aria-describedby={errors.fullName ? 'edit-student-name-error' : undefined}
          />
          <FieldError id="edit-student-name-error" message={errors.fullName} />
        </FieldBlock>
        <RadioCardGroup
          legend="Gender"
          name="edit-student-gender"
          value={gender}
          onChange={setGender}
          options={GENDERS.map((g) => ({ value: g, label: g }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="edit-student-class"
            label="Class"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setStreamId('');
            }}
          >
            <option value="">Not placed</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="edit-student-stream"
            label="Stream"
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            disabled={streams.length === 0}
          >
            <option value="">{classId && streams.length === 0 ? 'No streams' : 'No stream'}</option>
            {streams.map((s) => (
              <option key={s.stream_id as string} value={s.stream_id as string}>
                {s.stream_name}
              </option>
            ))}
          </SelectField>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* notes                                                               */
/* ------------------------------------------------------------------ */

function NotesCard({ studentId }: { studentId: string }) {
  const state = useSection<StudentNote[]>((signal) => getStudentNotes(studentId, { signal }), 'Could not load notes.');
  const [adding, setAdding] = useState(false);
  const [noteType, setNoteType] = useState<string>('general');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<StudentNote | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function openAdd() {
    setNoteType('general');
    setTitle('');
    setContent('');
    setErrors({});
    setSubmitError(null);
    setAdding(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = validateNote({ noteType, title, content });
    setErrors(found);
    if (hasErrors(found)) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await addStudentNote(studentId, noteType, title.trim(), content.trim());
      setAdding(false);
      state.reload();
    } catch (caught) {
      setSubmitError(describeAnalyticsError(caught, 'Could not save the note.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete || busy) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteStudentNote(toDelete.id);
      setToDelete(null);
      state.reload();
    } catch (caught) {
      setDeleteError(describeAnalyticsError(caught, 'Could not delete the note.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Notes"
        action={
          <Button size="sm" onClick={openAdd}>
            Add note
          </Button>
        }
      />
      <SectionBody
        state={state}
        empty={{ title: 'No notes yet', description: 'Add a note to keep a record of anything staff should know.' }}
      >
        {(rows) => (
          <ul className="divide-y divide-gray-100">
            {rows.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-gray-300 bg-gray-50 text-gray-700">{labelise(n.note_type)}</Badge>
                    <p className="font-medium text-gray-900">{n.title ?? 'Untitled'}</p>
                  </div>
                  {n.content && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{n.content}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    {[n.created_by_name, formatDate(n.created_at)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeleteError(null);
                    setToDelete(n);
                  }}
                  aria-label={`Delete note ${n.title ?? ''}`}
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
        title="Add note"
        footer={<FormFooter busy={busy} onCancel={() => setAdding(false)} submitLabel="Save note" formId="add-note-form" />}
      >
        <form id="add-note-form" onSubmit={submit} noValidate className="space-y-4">
          {submitError && <Alert tone="error" title="Note not saved">{submitError}</Alert>}
          <SelectField id="note-type" label="Type" value={noteType} onChange={(e) => setNoteType(e.target.value)}>
            {NOTE_TYPES.map((t) => (
              <option key={t} value={t}>
                {labelise(t)}
              </option>
            ))}
          </SelectField>
          <FieldBlock>
            <TextField
              id="note-title"
              label="Title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? 'note-title-error' : undefined}
            />
            <FieldError id="note-title-error" message={errors.title} />
          </FieldBlock>
          <FieldBlock>
            <TextAreaField
              id="note-content"
              label="Details"
              value={content}
              onChange={setContent}
              maxLength={4000}
              invalid={Boolean(errors.content)}
              describedBy={errors.content ? 'note-content-error' : undefined}
            />
            <FieldError id="note-content-error" message={errors.content} />
          </FieldBlock>
        </form>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this note?"
        confirmLabel="Delete note"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* groups and residence                                                */
/* ------------------------------------------------------------------ */

function PlacementCard({ studentId }: { studentId: string }) {
  const state = useSection<StudentMembership[]>(
    (signal) => getStudentMemberships(studentId, { signal }),
    'Could not load groups and residence.'
  );
  const [mode, setMode] = useState<'group' | 'residence' | null>(null);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [residences, setResidences] = useState<StudentResidence[]>([]);
  const [choice, setChoice] = useState('');
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function open(next: 'group' | 'residence') {
    setMode(next);
    setChoice('');
    setSubmitError(null);
    setOptionsError(null);
    try {
      if (next === 'group') setGroups(await getStudentGroups());
      else setResidences(await getStudentResidences());
    } catch (caught) {
      setOptionsError(describeAnalyticsError(caught, 'Could not load the list.'));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !mode) return;
    if (!choice) {
      setSubmitError(mode === 'group' ? 'Choose a group.' : 'Choose a residence.');
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      if (mode === 'group') await assignStudentToGroup(studentId, choice);
      else await assignStudentResidence(studentId, choice);
      setMode(null);
      state.reload();
    } catch (caught) {
      setSubmitError(describeAnalyticsError(caught, 'Could not save the assignment.'));
    } finally {
      setBusy(false);
    }
  }

  const options = mode === 'group' ? groups.map((g) => ({ id: g.id, name: g.name })) : residences.map((r) => ({ id: r.id, name: r.name }));

  return (
    <Card>
      <CardHeader
        title="Groups and residence"
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void open('group')}>
              Add to group
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void open('residence')}>
              Set residence
            </Button>
          </div>
        }
      />
      <SectionBody
        state={state}
        empty={{ title: 'No groups or residence', description: 'This student is not in any group and has no residence.' }}
      >
        {(rows) => (
          <ul className="divide-y divide-gray-100">
            {rows.map((m) => (
              <li key={`${m.kind}-${m.ref_id}`} className="flex flex-wrap items-center gap-2 px-5 py-3">
                <Badge className="border-gray-300 bg-gray-50 text-gray-700">{m.kind === 'group' ? 'Group' : 'Residence'}</Badge>
                <span className="font-medium text-gray-900">{m.name}</span>
                {m.detail && <span className="text-sm text-gray-500">{labelise(m.detail)}</span>}
              </li>
            ))}
          </ul>
        )}
      </SectionBody>

      <Modal
        open={mode !== null}
        onClose={busy ? () => undefined : () => setMode(null)}
        title={mode === 'group' ? 'Add to a group' : 'Set residence'}
        footer={<FormFooter busy={busy} onCancel={() => setMode(null)} submitLabel="Save" formId="placement-form" />}
      >
        <form id="placement-form" onSubmit={submit} noValidate className="space-y-4">
          {optionsError && <Alert tone="error" title="List unavailable">{optionsError}</Alert>}
          {submitError && <Alert tone="error" title="Not saved">{submitError}</Alert>}
          <SelectField
            id="placement-choice"
            label={mode === 'group' ? 'Group' : 'Residence'}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            disabled={options.length === 0}
          >
            <option value="">{options.length === 0 ? 'None available' : 'Choose…'}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </SelectField>
        </form>
      </Modal>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* emergency contacts                                                  */
/* ------------------------------------------------------------------ */

const EMPTY_CONTACT = {
  fullName: '',
  relationship: '',
  phonePrimary: '',
  phoneSecondary: '',
  email: '',
  notes: '',
  isPrimary: false,
  isAuthorizedPickup: false,
};

function ContactsCard({ studentId }: { studentId: string }) {
  const state = useSection<EmergencyContact[]>(
    (signal) => getEmergencyContacts(studentId, { signal }),
    'Could not load emergency contacts.'
  );
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [form, setForm] = useState(EMPTY_CONTACT);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function open(contact?: EmergencyContact) {
    setForm(
      contact
        ? {
            fullName: contact.full_name,
            relationship: contact.relationship,
            phonePrimary: contact.phone_primary,
            phoneSecondary: contact.phone_secondary ?? '',
            email: contact.email ?? '',
            notes: contact.notes ?? '',
            isPrimary: contact.is_primary,
            isAuthorizedPickup: contact.is_authorized_pickup,
          }
        : EMPTY_CONTACT
    );
    setErrors({});
    setSubmitError(null);
    setEditing({ id: contact?.contact_id });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !editing) return;
    const found = validateEmergencyContact(form);
    setErrors(found);
    if (hasErrors(found)) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await upsertEmergencyContact(
        studentId,
        form.fullName.trim(),
        form.relationship.trim(),
        form.phonePrimary.trim(),
        form.phoneSecondary.trim() || undefined,
        form.email.trim() || undefined,
        form.isPrimary,
        form.isAuthorizedPickup,
        form.notes.trim() || undefined,
        editing.id
      );
      setEditing(null);
      state.reload();
    } catch (caught) {
      setSubmitError(describeAnalyticsError(caught, 'Could not save the contact.'));
    } finally {
      setBusy(false);
    }
  }

  const bind = (key: keyof typeof EMPTY_CONTACT) => ({
    value: form[key] as string,
    onChange: (e: { target: { value: string } }) => setForm((p) => ({ ...p, [key]: e.target.value })),
    'aria-invalid': errors[key] ? (true as const) : undefined,
    'aria-describedby': errors[key] ? `contact-${key}-error` : undefined,
  });

  return (
    <Card>
      <CardHeader
        title="Emergency contacts"
        action={
          <Button size="sm" onClick={() => open()}>
            Add contact
          </Button>
        }
      />
      <SectionBody
        state={state}
        empty={{ title: 'No emergency contacts', description: 'Add at least one contact the school can reach.' }}
      >
        {(rows) => (
          <ul className="divide-y divide-gray-100">
            {rows.map((c) => (
              <li key={c.contact_id} className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900">{c.full_name}</p>
                    <span className="text-sm text-gray-500">{c.relationship}</span>
                    {c.is_primary && <Badge className="border-blue-300 bg-blue-50 text-blue-800">Primary</Badge>}
                    {c.is_authorized_pickup && (
                      <Badge className="border-emerald-300 bg-emerald-50 text-emerald-800">May collect</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-700">
                    <a className="text-blue-700 hover:underline" href={`tel:${c.phone_primary.replace(/\s/g, '')}`}>
                      {c.phone_primary}
                    </a>
                    {c.phone_secondary && <span className="text-gray-500"> · {c.phone_secondary}</span>}
                    {c.email && <span className="text-gray-500"> · {c.email}</span>}
                  </p>
                  {c.notes && <p className="mt-1 text-sm text-gray-600">{c.notes}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => open(c)} aria-label={`Edit ${c.full_name}`}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionBody>

      <Modal
        open={editing !== null}
        onClose={busy ? () => undefined : () => setEditing(null)}
        title={editing?.id ? 'Edit emergency contact' : 'Add emergency contact'}
        size="lg"
        footer={<FormFooter busy={busy} onCancel={() => setEditing(null)} submitLabel="Save contact" formId="contact-form" />}
      >
        <form id="contact-form" onSubmit={submit} noValidate className="space-y-4">
          {submitError && <Alert tone="error" title="Contact not saved">{submitError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <TextField id="contact-fullName" label="Full name *" {...bind('fullName')} />
              <FieldError id="contact-fullName-error" message={errors.fullName} />
            </FieldBlock>
            <FieldBlock>
              <TextField id="contact-relationship" label="Relationship *" {...bind('relationship')} />
              <FieldError id="contact-relationship-error" message={errors.relationship} />
            </FieldBlock>
            <FieldBlock>
              <TextField id="contact-phonePrimary" label="Primary phone *" type="tel" inputMode="tel" {...bind('phonePrimary')} />
              <FieldError id="contact-phonePrimary-error" message={errors.phonePrimary} />
            </FieldBlock>
            <FieldBlock>
              <TextField id="contact-phoneSecondary" label="Other phone" type="tel" inputMode="tel" {...bind('phoneSecondary')} />
              <FieldError id="contact-phoneSecondary-error" message={errors.phoneSecondary} />
            </FieldBlock>
            <div className="sm:col-span-2">
              <TextField id="contact-email" label="Email" type="email" {...bind('email')} />
              <FieldError id="contact-email-error" message={errors.email} />
            </div>
          </div>
          <TextAreaField
            id="contact-notes"
            label="Notes"
            rows={2}
            value={form.notes}
            onChange={(v) => setForm((p) => ({ ...p, notes: v }))}
          />
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-800">
            <label className="flex min-h-[2.75rem] items-center gap-2">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(e) => setForm((p) => ({ ...p, isPrimary: e.target.checked }))}
                className="h-4 w-4"
              />
              Primary contact
            </label>
            <label className="flex min-h-[2.75rem] items-center gap-2">
              <input
                type="checkbox"
                checked={form.isAuthorizedPickup}
                onChange={(e) => setForm((p) => ({ ...p, isAuthorizedPickup: e.target.checked }))}
                className="h-4 w-4"
              />
              May collect the student
            </label>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* medical alerts                                                      */
/* ------------------------------------------------------------------ */

const EMPTY_ALERT = {
  alertType: 'allergy',
  severity: 'medium',
  description: '',
  instructions: '',
  isActive: true,
};

function AlertsCard({ studentId }: { studentId: string }) {
  const state = useSection<MedicalAlert[]>(
    (signal) => getMedicalAlerts(studentId, { signal }),
    'Could not load medical alerts.'
  );
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [form, setForm] = useState(EMPTY_ALERT);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function open(alert?: MedicalAlert) {
    setForm(
      alert
        ? {
            alertType: alert.alert_type,
            severity: alert.severity,
            description: alert.description,
            instructions: alert.instructions ?? '',
            isActive: alert.is_active,
          }
        : EMPTY_ALERT
    );
    setErrors({});
    setSubmitError(null);
    setEditing({ id: alert?.alert_id });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !editing) return;
    const found = validateMedicalAlert(form);
    setErrors(found);
    if (hasErrors(found)) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await upsertMedicalAlert(
        studentId,
        form.alertType,
        form.description.trim(),
        form.severity,
        form.instructions.trim() || undefined,
        form.isActive,
        editing.id
      );
      setEditing(null);
      state.reload();
    } catch (caught) {
      setSubmitError(describeAnalyticsError(caught, 'Could not save the alert.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Medical alerts"
        action={
          <Button size="sm" onClick={() => open()}>
            Add alert
          </Button>
        }
      />
      <SectionBody
        state={state}
        empty={{ title: 'No medical alerts', description: 'Nothing has been recorded for this student.' }}
      >
        {(rows) => (
          <ul className="divide-y divide-gray-100">
            {rows.map((a) => (
              <li key={a.alert_id} className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.low}>{labelise(a.severity)}</Badge>
                    <Badge className="border-gray-300 bg-gray-50 text-gray-700">{labelise(a.alert_type)}</Badge>
                    {!a.is_active && <Badge className="border-gray-300 bg-white text-gray-500">Inactive</Badge>}
                  </div>
                  <p className="mt-1 text-gray-900">{a.description}</p>
                  {a.instructions && (
                    <p className="mt-1 text-sm text-gray-700">
                      <span className="font-medium">What to do:</span> {a.instructions}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => open(a)} aria-label={`Edit alert: ${a.description}`}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionBody>

      <Modal
        open={editing !== null}
        onClose={busy ? () => undefined : () => setEditing(null)}
        title={editing?.id ? 'Edit medical alert' : 'Add medical alert'}
        size="lg"
        footer={<FormFooter busy={busy} onCancel={() => setEditing(null)} submitLabel="Save alert" formId="alert-form" />}
      >
        <form id="alert-form" onSubmit={submit} noValidate className="space-y-4">
          {submitError && <Alert tone="error" title="Alert not saved">{submitError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="alert-type"
              label="Type"
              value={form.alertType}
              onChange={(e) => setForm((p) => ({ ...p, alertType: e.target.value }))}
            >
              {ALERT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {labelise(t)}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="alert-severity"
              label="Severity"
              value={form.severity}
              onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
            >
              {ALERT_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {labelise(s)}
                </option>
              ))}
            </SelectField>
          </div>
          <FieldBlock>
            <TextAreaField
              id="alert-description"
              label="Description *"
              rows={3}
              value={form.description}
              onChange={(v) => setForm((p) => ({ ...p, description: v }))}
              invalid={Boolean(errors.description)}
              describedBy={errors.description ? 'alert-description-error' : undefined}
            />
            <FieldError id="alert-description-error" message={errors.description} />
          </FieldBlock>
          <TextAreaField
            id="alert-instructions"
            label="What staff should do"
            rows={3}
            value={form.instructions}
            onChange={(v) => setForm((p) => ({ ...p, instructions: v }))}
          />
          <label className="flex min-h-[2.75rem] items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="h-4 w-4"
            />
            Alert is active
          </label>
        </form>
      </Modal>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* composed panels                                                     */
/* ------------------------------------------------------------------ */

export function StudentRecordPanels({ studentId }: { studentId: string }) {
  return (
    <>
      <AlertsCard studentId={studentId} />
      <ContactsCard studentId={studentId} />
      <PlacementCard studentId={studentId} />
      <NotesCard studentId={studentId} />
    </>
  );
}
