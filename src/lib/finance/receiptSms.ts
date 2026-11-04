// Single SMS message builder for finance documents.
//
// Rules enforced here, in one place:
//   * one message per document, returned complete -- never truncated in the caller
//   * maximum 160 GSM-7 septets (extension characters cost 2)
//   * the document link is never shortened or dropped
//   * if the link alone cannot fit, nothing is sent; the caller gets an error
//
// Callers must log the returned string as-is. They must not slice, pad or
// rebuild it.

/** GSM 03.38 basic character set (1 septet each). */
const GSM7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
);

/** GSM 03.38 extension characters (2 septets each). */
const GSM7_EXTENSION = new Set('^{}\\[~]|€');

export const SMS_MAX_SEPTETS = 160;

export class SmsTooLongError extends Error {
  constructor(public readonly link: string) {
    super('The document link is too long to fit in a single SMS. Shorten the public base URL.');
    this.name = 'SmsTooLongError';
  }
}

export function normalizePhoneKE(input: string): string | null {
  const t = (input ?? '').trim();
  if (!t) return null;
  let p = t;
  if (p.startsWith('0')) p = '+254' + p.slice(1);
  if (!p.startsWith('+254')) return null;
  const digits = p.replace(/\D/g, '');
  if (digits.length !== 12) return null;
  return p;
}

/**
 * Septet length of a GSM-7 message, or null when the text contains a character
 * outside GSM-7 (which would make the carrier use UCS-2 instead).
 */
export function gsm7Length(text: string): number | null {
  let length = 0;
  for (const ch of text) {
    if (GSM7_BASIC.has(ch)) {
      length += 1;
    } else if (GSM7_EXTENSION.has(ch)) {
      length += 2;
    } else {
      return null;
    }
  }
  return length;
}

/** Replace typographic characters with GSM-7 equivalents; drop anything else. */
export function toGsm7Safe(text: string): string {
  return (text ?? '')
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .split('')
    .filter((ch) => GSM7_BASIC.has(ch) || GSM7_EXTENSION.has(ch))
    .join('');
}

export function formatSmsAmount(amount: number): string {
  return `KES ${Number(amount ?? 0).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Return the first candidate that fits in one SMS segment.
 * Throws when even the shortest candidate cannot carry the link intact.
 */
function pickFitting(candidates: string[], link: string): string {
  for (const candidate of candidates) {
    const length = gsm7Length(candidate);
    if (length !== null && length <= SMS_MAX_SEPTETS) return candidate;
  }
  throw new SmsTooLongError(link);
}

function nameVariants(rawName: string): string[] {
  const name = toGsm7Safe(rawName).trim() || 'Student';
  const out: string[] = [];
  for (let len = Math.min(name.length, 20); len >= 1; len--) {
    out.push(name.slice(0, len).trim());
  }
  return out.filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
}

export function buildReceiptSms(opts: {
  schoolName: string;
  amountPaid: number;
  receiptNumber: string | null;
  link: string;
}): string {
  const link = (opts.link ?? '').trim();
  if (!link) throw new Error('A receipt link is required before sending SMS.');
  const amount = formatSmsAmount(opts.amountPaid);
  const receipt = toGsm7Safe(opts.receiptNumber ?? '').trim();
  const school = toGsm7Safe(opts.schoolName ?? '').trim() || 'School';

  const candidates: string[] = [];
  for (const nameLen of [Math.min(school.length, 20), 12, 6, 0]) {
    if (nameLen < 0) continue;
    const shortSchool = nameLen === 0 ? '' : school.slice(0, nameLen).trim();
    const atSchool = shortSchool ? ` at ${shortSchool}` : '';
    if (receipt) {
      candidates.push(`Hi, thanks for paying ${amount}${atSchool}. Receipt ${receipt}. Download: ${link}`);
    }
    candidates.push(`Hi, thanks for paying ${amount}${atSchool}. Download: ${link}`);
    candidates.push(`Payment ${amount} received${atSchool}. Download: ${link}`);
  }
  candidates.push(`Payment ${amount} received. Download: ${link}`);
  candidates.push(`Receipt: ${link}`);

  return pickFitting(candidates, link);
}

export function buildStatementSms(opts: {
  studentName: string;
  billed: number;
  paid: number;
  outstanding: number;
  link: string;
}): string {
  const link = (opts.link ?? '').trim();
  if (!link) throw new Error('A statement link is required before sending SMS.');
  const billed = formatSmsAmount(opts.billed);
  const paid = formatSmsAmount(opts.paid);
  const outstanding = Number(opts.outstanding ?? 0);
  const balance = outstanding < 0
    ? `credit ${formatSmsAmount(Math.abs(outstanding))}`
    : `outstanding ${formatSmsAmount(outstanding)}`;

  const candidates: string[] = [];
  for (const name of nameVariants(opts.studentName)) {
    candidates.push(`Fee statement for ${name}. Billed ${billed}, paid ${paid}, ${balance}. View: ${link}`);
    candidates.push(`Fee statement for ${name}. ${balance}. View: ${link}`);
    candidates.push(`Fee statement for ${name}. View: ${link}`);
  }
  candidates.push(`Fee statement. Billed ${billed}, paid ${paid}, ${balance}. View: ${link}`);
  candidates.push(`Fee statement. ${balance}. View: ${link}`);
  candidates.push(`Fee statement: ${link}`);

  return pickFitting(candidates, link);
}
