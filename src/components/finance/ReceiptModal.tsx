'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/overlays';
import { Button } from '@/components/ui';
import { getSchoolProfile, getStudentGuardianContacts, getReceipts, logMessage, createReceiptShareToken } from '@/lib/analytics/api';
import { normalizePhoneKE, buildReceiptSms } from '@/lib/finance/receiptSms';
import type { SchoolProfile } from '@/lib/analytics/types';

export interface ReceiptModalData {
  paymentId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  className: string | null;
  term: string | null;
  academicYear: number | null;
  amountPaid: number;
  method: string;
  reference: string | null;
  paidBy: string | null;
  receivedBy: string | null;
  paidAt: string;
  receiptNumber: string | null;
  balanceRemaining: number;
}

function formatKES(n: number) {
  return `KES ${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function termLabel(term: string | null, year: number | null) {
  const t = term ? term : 'Term 1';
  const y = year ?? new Date().getFullYear();
  return `${t} • ${y}`;
}

export function ReceiptModal({
  open,
  data,
  onClose,
  onViewStatement,
}: {
  open: boolean;
  data: ReceiptModalData | null;
  onClose: () => void;
  onViewStatement?: (studentId: string) => void;
}) {
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [guardians, setGuardians] = useState<{ guardian_name: string | null; guardian_phone: string | null }[]>([]);
  const [smsTarget, setSmsTarget] = useState<'guardian' | 'other'>('guardian');
  const [smsGuardianIdx, setSmsGuardianIdx] = useState(0);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsStatus, setSmsStatus] = useState<'idle' | 'sending' | 'queued' | 'sent' | 'failed' | 'error'>('idle');
  const [smsMessageId, setSmsMessageId] = useState<string | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(data?.receiptNumber ?? null);
  const [receiptLoading, setReceiptLoading] = useState<boolean>(!data?.receiptNumber);

  useEffect(() => {
    if (!open || !data) return;
    getSchoolProfile().then(setProfile).catch(() => setProfile(null));
    getStudentGuardianContacts(data.studentId).then((g) => setGuardians(g.map((x) => ({ guardian_name: x.guardian_name, guardian_phone: x.guardian_phone })))).catch(() => setGuardians([]));
    (async () => {
      setReceiptLoading(true);
      try {
        const receipts = await getReceipts();
        const r = receipts.find((x) => x.payment_id === data.paymentId);
        if (r) {
          if (r.receipt_number) setReceiptNumber(r.receipt_number);
          if (r.receipt_id) {
            try { const token = await createReceiptShareToken(r.receipt_id, 30); setShareToken(token); } catch { /* ignore */ }
          }
        }
      } catch (e) { console.error('[receipt] getReceipts failed', e); }
      // fallback: try statement
      if (!receiptNumber) {
        try {
          const { getFeeStatement } = await import('@/lib/analytics/api');
          const stmt = await getFeeStatement(data.studentId);
          const rows = stmt.filter((x) => x.row_kind === 'payment' || x.row_kind === 'reversal');
          if (rows.length) {
            const latest = rows.reduce((a, b) => (new Date(b.occurred_at ?? 0).getTime() > new Date(a.occurred_at ?? 0).getTime() ? b : a));
            if (latest.receipt_number) setReceiptNumber(latest.receipt_number);
          }
        } catch (e) { console.error('[receipt] getFeeStatement failed', e); }
      }
      setReceiptLoading(false);
    })();
  }, [open, data]);

  if (!data) return null;

  const handlePrint = () => {
    window.print();
  };

  const buildSmsMessage = (link: string) => {
    const school = (profile?.name ?? 'School').slice(0, 20);
    const amt = formatKES(data.amountPaid);
    const base = `Hi, thanks for paying ${amt} at ${school}. Receipt ${receiptNumber ?? ''}. Download: ${link}`;
    // GSM-7, max 160: shorten school name first if needed
    if (base.length <= 160) return base;
    // shorten school name
    let msg = base;
    // try progressively shorter school name
    for (let len = school.length; len >= 5; len--) {
      const s = (profile?.name ?? 'School').slice(0, len);
      const candidate = `Hi, thanks for paying ${amt} at ${s}. Receipt ${receiptNumber ?? ''}. Download: ${link}`;
      if (candidate.length <= 160) { msg = candidate; break; }
    }
    return msg;
  };

  const handleSendSms = async () => {
    setSmsStatus('sending');
    setSmsError(null);
    let rawPhone = '';
    if (smsTarget === 'guardian') {
      rawPhone = guardians[smsGuardianIdx]?.guardian_phone ?? '';
    } else {
      rawPhone = smsPhone.trim();
    }
    const phone = normalizePhoneKE(rawPhone);
    if (!phone) {
      setSmsStatus('error');
      setSmsError('Invalid phone number. Use +254…');
      return;
    }
    // create share token now
    let token = shareToken;
    if (!token) {
      try {
        const receipts = await getReceipts();
        const r = receipts.find((x) => x.payment_id === data.paymentId);
        if (r?.receipt_id) token = await createReceiptShareToken(r.receipt_id, 30);
        if (token) setShareToken(token);
      } catch { token = null; }
    }
    const link = token ? `${window.location.origin}/receipt/${token}` : '';
    const message = buildSmsMessage(link || '(link unavailable)');
    if (message.length > 160) {
      // safety: never send over 160
    }
    try {
      const msgId = await logMessage('specific_students', [data.studentId], 'text', 'Fee receipt', message.slice(0, 160), [phone], 1, 1);
      setSmsMessageId(msgId);
      setSmsStatus('queued');
      // poll for status
      (async () => {
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          try {
            const { getMessageHistory } = await import('@/lib/analytics/api');
            const history = await getMessageHistory(50);
            const row = history.find((h: any) => h.message_id === msgId || h.id === msgId);
            if (row) {
              const st = String(row.status ?? '').toLowerCase();
              if (st === 'sent' || st === 'delivered') { setSmsStatus('sent'); return; }
              if (st === 'failed' || st === 'error') { setSmsStatus('failed'); setSmsError('SMS failed to send.'); return; }
            }
          } catch { /* ignore */ }
        }
      })();
    } catch (e) {
      setSmsStatus('error');
      setSmsError(e instanceof Error ? e.message : 'Failed to queue SMS.');
    }
  };

  const handleViewStatement = () => {
    if (onViewStatement) onViewStatement(data.studentId);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Receipt" size="lg">
      <div className="print:shadow-none">
        <style>{`@media print { @page { size: A4 portrait; margin: 16mm; } .no-print { display: none !important; } }`}</style>
        <div className="mb-4 text-center">
          {profile?.logo_url && <img src={profile.logo_url} alt="logo" className="mx-auto mb-2 h-12 w-auto" />}
          <h3 className="text-lg font-bold">{profile?.name ?? 'School'}</h3>
          {profile?.motto && <p className="text-xs italic text-gray-600">{profile.motto}</p>}
          <p className="text-xs text-gray-500">{[profile?.county, profile?.region, profile?.country].filter(Boolean).join(', ')}</p>
          <p className="text-xs text-gray-500">{profile?.contact_phone && `Tel: ${profile.contact_phone}`} {profile?.contact_email && `Email: ${profile.contact_email}`}</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
          <div><span className="font-semibold">Receipt No.:</span> {receiptLoading ? 'Loading…' : (receiptNumber ?? '—')}</div>
          <div><span className="font-semibold">Date/Time:</span> {new Date(data.paidAt).toLocaleString()}</div>
          <div><span className="font-semibold">Student:</span> {data.studentName}</div>
          <div><span className="font-semibold">Adm No.:</span> {data.admissionNo}</div>
          <div><span className="font-semibold">Grade:</span> {data.className ?? '—'}</div>
          <div><span className="font-semibold">Term:</span> {termLabel(data.term, data.academicYear)}</div>
          <div><span className="font-semibold">Amount paid:</span> {formatKES(data.amountPaid)}</div>
          <div><span className="font-semibold">Method:</span> {data.method}</div>
          <div><span className="font-semibold">Reference:</span> {data.reference ?? '—'}</div>
          <div><span className="font-semibold">Paid by:</span> {data.paidBy ?? '—'}</div>
          <div><span className="font-semibold">Balance remaining:</span> {formatKES(data.balanceRemaining)}</div>
          <div><span className="font-semibold">Received by:</span> {data.receivedBy ?? '—'}</div>
        </div>

        <div className="no-print mt-4 space-y-3 border-t pt-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={handlePrint}>Print (A4)</Button>
            {shareToken && (
              <Button variant="secondary" onClick={() => window.open(`/receipt/${shareToken}?format=thermal`, '_blank')}>Print (80mm)</Button>
            )}
            <Button variant="secondary" onClick={handleViewStatement}>View fee statement</Button>
            <Button variant="secondary" onClick={onClose}>Done</Button>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <p className="mb-2 text-sm font-semibold">Send via SMS</p>
            <fieldset className="mb-2">
              <legend className="sr-only">SMS recipient</legend>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1"><input type="radio" checked={smsTarget === 'guardian'} onChange={() => setSmsTarget('guardian')} /> Guardian on file</label>
                <label className="flex items-center gap-1"><input type="radio" checked={smsTarget === 'other'} onChange={() => setSmsTarget('other')} /> Another number</label>
              </div>
            </fieldset>
            {smsTarget === 'guardian' ? (
              <div>
                <label htmlFor="sms-guardian" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Guardian</label>
                <select id="sms-guardian" value={smsGuardianIdx} onChange={(e) => setSmsGuardianIdx(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  {guardians.length === 0 && <option value={0}>No guardians on file</option>}
                  {guardians.map((g, i) => (
                    <option key={i} value={i}>{g.guardian_name ?? 'Guardian'} {g.guardian_phone ? `(${g.guardian_phone})` : ''}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label htmlFor="sms-phone" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Phone number</label>
                <input
                  id="sms-phone"
                  type="tel"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  placeholder="+2547XXXXXXXX"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="primary"
                onClick={handleSendSms}
                disabled={smsStatus === 'sending' || smsStatus === 'queued' || (smsTarget === 'guardian' && guardians.length === 0 && !guardians[smsGuardianIdx]?.guardian_phone)}
              >
                {smsStatus === 'sending' ? 'Queuing…' : 'Send'}
              </Button>
              {smsStatus === 'queued' && <span className="text-sm text-amber-700">Queued for sending via device.</span>}
              {smsStatus === 'sent' && <span className="text-sm text-green-700">Sent.</span>}
              {smsStatus === 'failed' && <span className="text-sm text-red-700">{smsError ?? 'Failed.'} <button className="underline" onClick={handleSendSms}>Retry</button></span>}
              {smsStatus === 'error' && <span className="text-sm text-red-700">{smsError} <button className="underline" onClick={handleSendSms}>Retry</button></span>}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
