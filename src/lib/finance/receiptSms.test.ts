import { describe, it, expect } from 'vitest';
import { normalizePhoneKE, buildReceiptSms } from './receiptSms';

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

describe('buildReceiptSms', () => {
  it('stays within 160 chars when possible', () => {
    const msg = buildReceiptSms({ schoolName: 'Gureta Nyasoko Comprehensive School', amountPaid: 3400, receiptNumber: 'RCP-0001', link: 'https://x.test/r/abc' });
    expect(msg.length).toBeLessThanOrEqual(160);
    expect(msg).toContain('KES 3,400.00');
  });
});
