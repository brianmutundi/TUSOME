import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AnalyticsAPIError, isAnalyticsAPIError } from './errors';
import { generateIdempotencyKey, isValidIdempotencyKey } from './idempotency';
import {
  validateRequiredString,
  validateUuid,
  validatePositiveNumber,
  validateNonNegativeNumber,
  validateEnum,
  validateDate,
  validateEmail,
  sanitizeHtml,
} from './validation';

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

describe('AnalyticsAPIError', () => {
  it('creates error with code and message', () => {
    const err = new AnalyticsAPIError('VALIDATION_ERROR', 'Email is required');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Email is required');
    expect(err.name).toBe('AnalyticsAPIError');
  });

  it('maps Supabase P0001 to appropriate error code', () => {
    const err = AnalyticsAPIError.fromSupabaseError({ code: 'P0001', message: 'Missing tenant claim' });
    expect(err.code).toBe('MISSING_TENANT');
  });

  it('maps access denied to ACCESS_DENIED', () => {
    const err = AnalyticsAPIError.fromSupabaseError({ code: 'P0001', message: 'Access denied: manage-fees' });
    expect(err.code).toBe('ACCESS_DENIED');
    expect(err.statusCode).toBe(403);
  });

  it('maps unique violation to CONFLICT', () => {
    const err = AnalyticsAPIError.fromSupabaseError({ code: '23505', message: 'duplicate key' });
    expect(err.code).toBe('CONFLICT');
    expect(err.statusCode).toBe(409);
  });

  it('maps foreign key violation to VALIDATION_ERROR', () => {
    const err = AnalyticsAPIError.fromSupabaseError({ code: '23503', message: 'fk violation' });
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(422);
  });

  it('serializes to JSON', () => {
    const err = new AnalyticsAPIError('NOT_FOUND', 'Student not found', undefined, 404);
    const json = err.toJSON();
    expect(json.code).toBe('NOT_FOUND');
    expect(json.message).toBe('Student not found');
    expect(json.statusCode).toBe(404);
  });

  it('type guard works', () => {
    const err = new AnalyticsAPIError('SERVER_ERROR', 'test');
    expect(isAnalyticsAPIError(err)).toBe(true);
    expect(isAnalyticsAPIError(new Error('test'))).toBe(false);
  });
});

describe('Idempotency', () => {
  it('generates stable keys', () => {
    const key1 = generateIdempotencyKey('payment', 'order-123', '50.00');
    const key2 = generateIdempotencyKey('payment', 'order-123', '50.00');
    expect(key1).toBe(key2);
  });

  it('generates different keys for different intents', () => {
    const key1 = generateIdempotencyKey('payment', 'order-123', '50.00');
    const key2 = generateIdempotencyKey('payment', 'order-456', '50.00');
    expect(key1).not.toBe(key2);
  });

  it('validates key format', () => {
    expect(isValidIdempotencyKey('payment:order-123:50.00')).toBe(true);
    expect(isValidIdempotencyKey('single')).toBe(false);
    expect(isValidIdempotencyKey('')).toBe(false);
    expect(isValidIdempotencyKey('a:')).toBe(false);
  });

  it('payment key includes amount', () => {
    const key = generateIdempotencyKey('payment', 'order-123', '50.00');
    expect(key).toContain('50.00');
  });
});

describe('Validation', () => {
  it('validates required strings', () => {
    expect(validateRequiredString('  hello  ', 'name')).toBe('hello');
    expect(() => validateRequiredString('', 'name')).toThrow();
    expect(() => validateRequiredString('   ', 'name')).toThrow();
    expect(() => validateRequiredString(123, 'name')).toThrow();
  });

  it('validates UUIDs', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(validateUuid(uuid, 'id')).toBe(uuid);
    expect(() => validateUuid('not-a-uuid', 'id')).toThrow();
    expect(() => validateUuid(123, 'id')).toThrow();
  });

  it('validates positive numbers', () => {
    expect(validatePositiveNumber(5, 'amount')).toBe(5);
    expect(validatePositiveNumber('5', 'amount')).toBe(5);
    expect(() => validatePositiveNumber(0, 'amount')).toThrow();
    expect(() => validatePositiveNumber(-1, 'amount')).toThrow();
    expect(() => validatePositiveNumber('abc', 'amount')).toThrow();
  });

  it('validates non-negative numbers', () => {
    expect(validateNonNegativeNumber(0, 'count')).toBe(0);
    expect(validateNonNegativeNumber(5, 'count')).toBe(5);
    expect(() => validateNonNegativeNumber(-1, 'count')).toThrow();
  });

  it('validates enums', () => {
    const allowed = ['cash', 'mpesa', 'bank'] as const;
    expect(validateEnum('cash', allowed, 'method')).toBe('cash');
    expect(() => validateEnum('credit', allowed, 'method')).toThrow();
  });

  it('validates dates', () => {
    expect(validateDate('2026-01-15', 'date')).toBe('2026-01-15');
    expect(() => validateDate('2026-13-01', 'date')).toThrow();
    expect(() => validateDate('not-a-date', 'date')).toThrow();
  });

  it('validates emails', () => {
    expect(validateEmail('test@example.com', 'email')).toBe('test@example.com');
    expect(() => validateEmail('invalid', 'email')).toThrow();
    expect(() => validateEmail('', 'email')).toThrow();
  });

  it('sanitizes HTML', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(sanitizeHtml("it's")).toBe("it&#039;s");
  });
});

describe('Error Code Mapping', () => {
  it('maps P0001 with "not found" to NOT_FOUND', () => {
    const err = AnalyticsAPIError.fromSupabaseError({ code: 'P0001', message: 'Student not found' });
    expect(err.code).toBe('NOT_FOUND');
  });

  it('maps P0001 with "Invalid" to VALIDATION_ERROR', () => {
    const err = AnalyticsAPIError.fromSupabaseError({ code: 'P0001', message: 'Invalid status' });
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('maps P0001 with "concurrent" to CONFLICT', () => {
    const err = AnalyticsAPIError.fromSupabaseError({ code: 'P0001', message: 'concurrent modification' });
    expect(err.code).toBe('CONFLICT');
  });

  it('returns SERVER_ERROR for unknown P0001', () => {
    const err = AnalyticsAPIError.fromSupabaseError({ code: 'P0001', message: 'something unexpected' });
    expect(err.code).toBe('SERVER_ERROR');
  });
});