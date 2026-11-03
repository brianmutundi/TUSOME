import type { TeacherAllocationType } from './types';
import { isValidEmail, isValidPhone, type FieldErrors } from './studentForms';

export const ALLOCATION_TYPES: ReadonlyArray<{ value: TeacherAllocationType; label: string }> = [
  { value: 'SUBJECT_TEACHER', label: 'Subject teacher' },
  { value: 'CLASS_TEACHER', label: 'Class teacher' },
  { value: 'CLASS_SUPERVISOR', label: 'Class supervisor' },
];

export function allocationLabel(type: TeacherAllocationType): string {
  return ALLOCATION_TYPES.find((t) => t.value === type)?.label ?? type;
}

export interface TeacherInput {
  fullName: string;
  email: string;
  phone: string;
  initials: string;
}

export function validateTeacher(input: TeacherInput): FieldErrors<keyof TeacherInput> {
  const errors: FieldErrors<keyof TeacherInput> = {};
  if (!input.fullName.trim()) errors.fullName = 'Full name is required.';
  if (!input.email.trim()) errors.email = 'Email is required.';
  else if (!isValidEmail(input.email)) errors.email = 'Enter a valid email address.';
  if (input.initials.trim().length > 12) errors.initials = 'Initials can be at most 12 characters.';
  if (input.phone.trim() && !isValidPhone(input.phone)) errors.phone = 'Enter a valid phone number.';
  return errors;
}

export interface AllocationInput {
  allocationType: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  academicYear: string;
}

export function validateAllocation(
  input: AllocationInput,
  today: Date = new Date()
): FieldErrors<keyof AllocationInput> {
  const errors: FieldErrors<keyof AllocationInput> = {};
  if (!ALLOCATION_TYPES.some((t) => t.value === input.allocationType)) {
    errors.allocationType = 'Choose an assignment type.';
  }
  if (!input.classId) errors.classId = 'Choose a class.';
  if (input.allocationType === 'SUBJECT_TEACHER' && !input.subjectId) {
    errors.subjectId = 'Choose a subject for a subject teacher.';
  }
  if (!input.teacherId) errors.teacherId = 'Choose a teacher.';
  const year = Number(input.academicYear);
  const max = today.getFullYear() + 1;
  if (!Number.isInteger(year) || year < 2000 || year > max) {
    errors.academicYear = `Enter a year between 2000 and ${max}.`;
  }
  return errors;
}

export function validateGroupName(name: string, existing: string[]): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return 'A group name is required.';
  if (trimmed.length > 80) return 'Keep the name under 80 characters.';
  if (existing.some((e) => e.trim().toLowerCase() === trimmed.toLowerCase())) {
    return 'A group with this name already exists.';
  }
  return undefined;
}
