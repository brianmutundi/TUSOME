/**
 * Client-side validation and option lists for the student record forms.
 * The database re-checks everything (see 20261028000052_student_record_access.sql);
 * these checks only give fast, readable feedback.
 */

export const NOTE_TYPES = ['general', 'academic', 'behavioural', 'medical', 'disciplinary'] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const ALERT_TYPES = [
  'allergy',
  'chronic_condition',
  'medication',
  'disability',
  'special_needs',
  'other',
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const GENDERS = ['Male', 'Female'] as const;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,17}[0-9]$/;

export function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value.trim());
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function labelise(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface NewStudentInput {
  admissionNo: string;
  fullName: string;
  gender: string;
  academicYear: string;
  dateOfBirth: string;
  primaryPhone: string;
}

export function validateNewStudent(
  input: NewStudentInput,
  today: Date = new Date()
): FieldErrors<keyof NewStudentInput> {
  const errors: FieldErrors<keyof NewStudentInput> = {};
  if (!input.admissionNo.trim()) errors.admissionNo = 'Admission number is required.';
  if (!input.fullName.trim()) errors.fullName = 'Full name is required.';
  if (input.gender && !(GENDERS as readonly string[]).includes(input.gender)) {
    errors.gender = 'Choose Male or Female.';
  }
  if (input.academicYear) {
    const year = Number(input.academicYear);
    const max = today.getFullYear() + 1;
    if (!Number.isInteger(year) || year < 2000 || year > max) {
      errors.academicYear = `Enter a year between 2000 and ${max}.`;
    }
  }
  if (input.dateOfBirth) {
    const dob = new Date(input.dateOfBirth);
    if (Number.isNaN(dob.getTime()) || dob > today) {
      errors.dateOfBirth = 'Date of birth must be a valid date in the past.';
    }
  }
  if (input.primaryPhone && !isValidPhone(input.primaryPhone)) {
    errors.primaryPhone = 'Enter a valid phone number, for example 0712 345 678.';
  }
  return errors;
}

export interface NoteInput {
  noteType: string;
  title: string;
  content: string;
}

export function validateNote(input: NoteInput): FieldErrors<keyof NoteInput> {
  const errors: FieldErrors<keyof NoteInput> = {};
  if (!(NOTE_TYPES as readonly string[]).includes(input.noteType)) {
    errors.noteType = 'Choose a note type.';
  }
  if (!input.title.trim()) errors.title = 'A title is required.';
  else if (input.title.trim().length > 120) errors.title = 'Keep the title under 120 characters.';
  if (input.content.length > 4000) errors.content = 'Keep the note under 4,000 characters.';
  return errors;
}

export interface EmergencyContactInput {
  fullName: string;
  relationship: string;
  phonePrimary: string;
  phoneSecondary: string;
  email: string;
}

export function validateEmergencyContact(
  input: EmergencyContactInput
): FieldErrors<keyof EmergencyContactInput> {
  const errors: FieldErrors<keyof EmergencyContactInput> = {};
  if (!input.fullName.trim()) errors.fullName = 'Contact name is required.';
  if (!input.relationship.trim()) errors.relationship = 'Relationship is required.';
  if (!input.phonePrimary.trim()) errors.phonePrimary = 'Primary phone is required.';
  else if (!isValidPhone(input.phonePrimary)) errors.phonePrimary = 'Enter a valid phone number.';
  if (input.phoneSecondary.trim() && !isValidPhone(input.phoneSecondary)) {
    errors.phoneSecondary = 'Enter a valid phone number.';
  }
  if (input.email.trim() && !isValidEmail(input.email)) errors.email = 'Enter a valid email address.';
  return errors;
}

export interface MedicalAlertInput {
  alertType: string;
  severity: string;
  description: string;
}

export function validateMedicalAlert(
  input: MedicalAlertInput
): FieldErrors<keyof MedicalAlertInput> {
  const errors: FieldErrors<keyof MedicalAlertInput> = {};
  if (!(ALERT_TYPES as readonly string[]).includes(input.alertType)) {
    errors.alertType = 'Choose an alert type.';
  }
  if (!(ALERT_SEVERITIES as readonly string[]).includes(input.severity)) {
    errors.severity = 'Choose a severity.';
  }
  if (!input.description.trim()) errors.description = 'A description is required.';
  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
