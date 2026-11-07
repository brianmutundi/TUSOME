/** Small text coercions shared across features. */


export const textOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
