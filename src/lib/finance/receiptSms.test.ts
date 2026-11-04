import { describe, it, expect } from 'vitest';
import {
  buildReceiptSms,
  buildStatementSms,
  gsm7Length,
  normalizePhoneKE,
  SmsTooLongError,
  SMS_MAX_SEPTETS,
} from './receiptSms';

describe('normalizePhoneKE', () => {
  it('normalises 07... to +254...', () => {
    expect(normalizePhoneKE('0712345678')).toBe('+254712345678');
  });
  it('keeps +254...', () => {
    expect(normalizePhoneKE('+254712345678')).toBe('+254712345678');
  });
  it('rejects invalid', () => {
    expect(normalizePhoneKE('123')).toBeNull();
    expect(normalizePhoneKE('')).toBeNull();
  });
});

describe('gsm7Length', () => {
  it('counts basic characters as one septet', () => {
    expect(gsm7Length('KES 3,400.00')).toBe(12);
  });
  it('counts extension characters as two septets', () => {
    expect(gsm7Length('[]')).toBe(4);
  });
  it('rejects characters outside GSM-7', () => {
    expect(gsm7Length('hi 🙂there')).toBeNull();
  });
});

describe('buildReceiptSms', () => {
  it('stays within 160 septets for a long school name', () => {
    const msg = buildReceiptSms({
      schoolName: 'Gureta Nyasoko Comprehensive School',
      amountPaid: 3400,
      receiptNumber: 'RCP-26-000030',
      link: 'https://tusome.example/receipt/abcdefghijklmnop',
    });
    expect(gsm7Length(msg)).toBeLessThanOrEqual(SMS_MAX_SEPTETS);
    expect(msg).toContain('https://tusome.example/receipt/abcdefghijklmnop');
    expect(msg).toContain('KES 3,400.00');
  });

  it('always keeps the link intact', () => {
    const link = 'https://tusome.example/receipt/abcdefghijklmnop';
    const msg = buildReceiptSms({
      schoolName: 'Gureta Nyasoko Comprehensive School',
      amountPaid: 1234567.5,
      receiptNumber: 'RCP-26-000030',
      link,
    });
    expect(msg.endsWith(link)).toBe(true);
  });

  it('throws instead of truncating when the link cannot fit', () => {
    const link = 'https://' + 'a'.repeat(200) + '/receipt/abcdefghijklmnop';
    expect(() => buildReceiptSms({
      schoolName: 'School',
      amountPaid: 1,
      receiptNumber: 'RCP-26-000030',
      link,
    })).toThrow(SmsTooLongError);
  });

  it('sanitises typographic characters to GSM-7', () => {
    const msg = buildReceiptSms({
      schoolName: 'St. Mary\u2019s \u2014 Nairobi',
      amountPaid: 10,
      receiptNumber: 'RCP-26-000001',
      link: 'https://x.test/receipt/abcdefghijklmnop',
    });
    expect(gsm7Length(msg)).not.toBeNull();
  });
});

describe('buildStatementSms', () => {
  it('summarises billed, paid and outstanding within one segment', () => {
    const msg = buildStatementSms({
      studentName: 'Amina Otieno',
      billed: 5000,
      paid: 4450,
      outstanding: 550,
      link: 'https://tusome.example/statement/abcdefghijklmnop',
    });
    expect(gsm7Length(msg)).toBeLessThanOrEqual(SMS_MAX_SEPTETS);
    expect(msg).toContain('KES 5,000.00');
    expect(msg).toContain('outstanding KES 550.00');
    expect(msg.endsWith('https://tusome.example/statement/abcdefghijklmnop')).toBe(true);
  });

  it('labels a negative balance as credit', () => {
    const msg = buildStatementSms({
      studentName: 'Amina Otieno',
      billed: 5000,
      paid: 5700,
      outstanding: -700,
      link: 'https://x.test/statement/abcdefghijklmnop',
    });
    expect(msg).toContain('credit KES 700.00');
    expect(msg).not.toContain('-700');
  });

  it('throws instead of truncating when the link cannot fit', () => {
    expect(() => buildStatementSms({
      studentName: 'Amina Otieno',
      billed: 5000,
      paid: 4450,
      outstanding: 550,
      link: 'https://' + 'a'.repeat(200) + '/statement/abcdefghijklmnop',
    })).toThrow(SmsTooLongError);
  });
});
