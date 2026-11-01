/**
 * Input validation utilities for the TUSOME analytics API layer.
 *
 * Validates at system boundaries (API calls, form submissions) before
 * data reaches internal code or the database.
 */

import { AnalyticsAPIError } from './errors';

/**
 * Validate that a value is a non-empty string.
 */
export function validateRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw AnalyticsAPIError.validation(`${fieldName} is required`);
  }
  return value.trim();
}

/**
 * Validate that a value is a valid UUID.
 */
export function validateUuid(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw AnalyticsAPIError.validation(`${fieldName} must be a string`);
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw AnalyticsAPIError.validation(`${fieldName} must be a valid UUID`);
  }
  return value;
}

/**
 * Validate that a value is a positive number.
 */
export function validatePositiveNumber(value: unknown, fieldName: string): number {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof num !== 'number' || isNaN(num) || num <= 0) {
    throw AnalyticsAPIError.validation(`${fieldName} must be a positive number`);
  }
  return num;
}

/**
 * Validate that a value is a non-negative number.
 */
export function validateNonNegativeNumber(value: unknown, fieldName: string): number {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof num !== 'number' || isNaN(num) || num < 0) {
    throw AnalyticsAPIError.validation(`${fieldName} must be a non-negative number`);
  }
  return num;
}

/**
 * Validate that a value is one of the allowed enum values.
 */
export function validateEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw AnalyticsAPIError.validation(
      `${fieldName} must be one of: ${allowed.join(', ')}`
    );
  }
  return value as T;
}

/**
 * Validate that a value is a valid date string (YYYY-MM-DD).
 */
export function validateDate(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw AnalyticsAPIError.validation(`${fieldName} must be a date string`);
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    throw AnalyticsAPIError.validation(`${fieldName} must be in YYYY-MM-DD format`);
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw AnalyticsAPIError.validation(`${fieldName} is not a valid date`);
  }
  return value;
}

/**
 * Validate that an email is valid format.
 */
export function validateEmail(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw AnalyticsAPIError.validation(`${fieldName} is required`);
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    throw AnalyticsAPIError.validation(`${fieldName} must be a valid email`);
  }
  return value.trim().toLowerCase();
}

/**
 * Sanitize a string to prevent XSS in HTML rendering.
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}