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

export function buildReceiptSms(opts: {
  schoolName: string;
  amountPaid: number;
  receiptNumber: string | null;
  link: string;
}): string {
  const format = (n: number) => `KES ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const amt = format(opts.amountPaid);
  const school = opts.schoolName ?? 'School';
  const rcpt = opts.receiptNumber ?? '';
  const link = opts.link ?? '';
  const make = (s: string) => `Hi, thanks for paying ${amt} at ${s}. Receipt ${rcpt}. Download: ${link}`;
  let msg = make(school.slice(0, 20));
  if (msg.length <= 160) return msg;
  for (let len = school.length; len >= 5; len--) {
    const candidate = make(school.slice(0, len));
    if (candidate.length <= 160) { msg = candidate; break; }
  }
  return msg;
}
