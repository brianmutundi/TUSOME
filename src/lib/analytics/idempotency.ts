/**
 * Idempotency utilities for state-changing operations.
 *
 * Provides a consistent way to generate and manage idempotency keys
 * for payment processing, waiver approvals, and other financial operations.
 */

/**
 * Generate an idempotency key from stable identifiers.
 * The key must be stable across retries of one intent and different
 * across distinct intents.
 *
 * @param namespace - The operation namespace (e.g., 'payment', 'waiver')
 * @param identifiers - Immutable identifiers for the intent
 * @returns A stable idempotency key
 */
export function generateIdempotencyKey(
  namespace: string,
  ...identifiers: string[]
): string {
  return `${namespace}:${identifiers.join(':')}`;
}

/**
 * Generate a client-side idempotency key for a payment.
 * Uses the order ID and amount to ensure the same payment intent
 * produces the same key.
 */
export function paymentIdempotencyKey(orderId: string, amount: number): string {
  return generateIdempotencyKey('payment', orderId, String(amount));
}

/**
 * Generate an idempotency key for a waiver approval.
 */
export function waiverApprovalKey(waiverId: string): string {
  return generateIdempotencyKey('waiver-approval', waiverId);
}

/**
 * Generate an idempotency key for a fee collection.
 */
export function feeCollectionKey(studentId: string, amount: number, timestamp: string): string {
  return generateIdempotencyKey('fee-collection', studentId, String(amount), timestamp);
}

/**
 * Validate that an idempotency key follows the expected format.
 */
export function isValidIdempotencyKey(key: string): boolean {
  const parts = key.split(':');
  return parts.length >= 2 && parts.every((p) => p.length > 0);
}