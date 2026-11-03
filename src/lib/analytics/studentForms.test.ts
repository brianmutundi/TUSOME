import { describe, expect, it } from 'vitest';
import {
  hasErrors,
  isValidPhone,
  validateEmergencyContact,
  validateMedicalAlert,
  validateNewStudent,
  validateNote,
} from './studentForms';

const today = new Date('2026-11-01T00:00:00Z');
const goodStudent = {
  admissionNo: 'A-100',
  fullName: 'Wanjiru Kamau',
  gender: 'Female',
  academicYear: '2026',
  dateOfBirth: '2014-05-02',
  primaryPhone: '0712 345 678',
};

describe('validateNewStudent', () => {
  it('accepts a complete record', () => {
    expect(hasErrors(validateNewStudent(goodStudent, today))).toBe(false);
  });
  it('requires admission number and name', () => {
    const e = validateNewStudent({ ...goodStudent, admissionNo: ' ', fullName: '' }, today);
    expect(e.admissionNo).toBeTruthy();
    expect(e.fullName).toBeTruthy();
  });
  it('rejects a future date of birth and a bad year', () => {
    const e = validateNewStudent({ ...goodStudent, dateOfBirth: '2030-01-01', academicYear: '1999' }, today);
    expect(e.dateOfBirth).toBeTruthy();
    expect(e.academicYear).toBeTruthy();
  });
  it('treats optional fields as optional', () => {
    const e = validateNewStudent(
      { admissionNo: 'A-1', fullName: 'X', gender: '', academicYear: '', dateOfBirth: '', primaryPhone: '' },
      today
    );
    expect(hasErrors(e)).toBe(false);
  });
});

describe('phones', () => {
  it('accepts local and international formats', () => {
    expect(isValidPhone('0712345678')).toBe(true);
    expect(isValidPhone('+254 712 345 678')).toBe(true);
  });
  it('rejects letters and short numbers', () => {
    expect(isValidPhone('abc')).toBe(false);
    expect(isValidPhone('12345')).toBe(false);
  });
});

describe('validateNote', () => {
  it('requires a known type and a title', () => {
    expect(validateNote({ noteType: 'gossip', title: '', content: '' })).toMatchObject({
      noteType: expect.any(String),
      title: expect.any(String),
    });
    expect(hasErrors(validateNote({ noteType: 'academic', title: 'Reading level', content: '' }))).toBe(false);
  });
});

describe('validateEmergencyContact', () => {
  it('requires name, relationship and primary phone', () => {
    const e = validateEmergencyContact({ fullName: '', relationship: '', phonePrimary: '', phoneSecondary: '', email: '' });
    expect(Object.keys(e).sort()).toEqual(['fullName', 'phonePrimary', 'relationship']);
  });
  it('checks optional email and secondary phone when given', () => {
    const e = validateEmergencyContact({
      fullName: 'A', relationship: 'Aunt', phonePrimary: '0712345678', phoneSecondary: 'x', email: 'nope',
    });
    expect(e.phoneSecondary).toBeTruthy();
    expect(e.email).toBeTruthy();
  });
});

describe('validateMedicalAlert', () => {
  it('matches the database check constraints', () => {
    expect(hasErrors(validateMedicalAlert({ alertType: 'allergy', severity: 'critical', description: 'Peanuts' }))).toBe(false);
    const e = validateMedicalAlert({ alertType: 'flu', severity: 'severe', description: ' ' });
    expect(Object.keys(e).sort()).toEqual(['alertType', 'description', 'severity']);
  });
});
