import { describe, expect, it } from 'vitest';
import { allocationLabel, validateAllocation, validateGroupName, validateTeacher } from './teacherForms';

const today = new Date('2026-11-01T00:00:00Z');

describe('validateTeacher', () => {
  it('requires name and a valid email', () => {
    const e = validateTeacher({ fullName: '', email: 'nope', phone: '', initials: '' });
    expect(Object.keys(e).sort()).toEqual(['email', 'fullName']);
  });
  it('limits initials to 12 characters like the database', () => {
    expect(validateTeacher({ fullName: 'A', email: 'a@b.co', phone: '', initials: 'ABCDEFGHIJKLM' }).initials).toBeTruthy();
    expect(validateTeacher({ fullName: 'A', email: 'a@b.co', phone: '', initials: 'ABCDEFGHIJKL' }).initials).toBe(undefined);
  });
});

describe('validateAllocation', () => {
  const base = { allocationType: 'CLASS_TEACHER', classId: 'c', subjectId: '', teacherId: 't', academicYear: '2026' };
  it('does not need a subject for class roles', () => {
    expect(Object.keys(validateAllocation(base, today))).toEqual([]);
  });
  it('needs a subject for subject teachers', () => {
    expect(validateAllocation({ ...base, allocationType: 'SUBJECT_TEACHER' }, today).subjectId).toBeTruthy();
  });
  it('rejects unknown types and missing ids', () => {
    const e = validateAllocation({ ...base, allocationType: 'HEAD', classId: '', teacherId: '' }, today);
    expect(Object.keys(e).sort()).toEqual(['allocationType', 'classId', 'teacherId']);
  });
});

describe('validateGroupName', () => {
  it('rejects blanks and case-insensitive duplicates', () => {
    expect(validateGroupName(' ', [])).toBeTruthy();
    expect(validateGroupName('science', ['Science'])).toBeTruthy();
    expect(validateGroupName('Arts', ['Science'])).toBe(undefined);
  });
});

describe('allocationLabel', () => {
  it('has readable labels', () => {
    expect(allocationLabel('CLASS_SUPERVISOR')).toBe('Class supervisor');
  });
});
