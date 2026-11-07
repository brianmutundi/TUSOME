import { describe, expect, it } from 'vitest';
import { AnalyticsAPIError, isAnalyticsAPIError } from './errors';

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
