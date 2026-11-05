'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel } from '@/components/ui';
import {
  describeAnalyticsError,
  getMyChildren,
  isAbortError,
  setMyPhone,
  type MyChild,
} from '@/lib/analytics/api';

export default function ParentHomePage() {
  const [children, setChildren] = useState<MyChild[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [phoneMsg, setPhoneMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getMyChildren({ signal: controller.signal })
      .then(setChildren)
      .catch((caught) => {
        if (isAbortError(caught)) return;
        console.error('getMyChildren failed:', caught);
        setError(describeAnalyticsError(caught, 'Could not load your children.'));
      });
    return () => controller.abort();
  }, []);

  const savePhone = async () => {
    setSaving(true);
    setPhoneMsg(null);
    try {
      const saved = await setMyPhone(phone);
      setPhoneMsg({ tone: 'success', text: `Saved ${saved}. M-Pesa prompts will go to this number.` });
    } catch (caught) {
      setPhoneMsg({ tone: 'error', text: describeAnalyticsError(caught, 'Could not save the number.') });
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return <Alert tone="error" title="Could not load">{error}</Alert>;
  }
  if (!children) return <LoadingPanel label="Loading your children…" />;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Parent portal</h1>
        <p className="text-sm text-gray-500">View your children's fees, receipts, results, and attendance.</p>
      </header>
      <Card>
        <CardHeader title="My children" />
        {children.length === 0 ? (
          <EmptyState
            title="No children linked yet"
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {children.map((c) => (
              <li key={c.studentId}>
                <Link
                  href={`/parent/${c.studentId}`}
                  className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{c.fullName}</p>
                    <p className="text-sm text-gray-500">
                      Adm {c.admissionNo}
                      {c.className ? ` · ${c.className}` : ''}
                    </p>
                  </div>
                  <Badge className="border-gray-200 bg-gray-50 text-gray-700">{c.relationship}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="M-Pesa number" />
        <div className="space-y-3 px-5 py-4">
          {phoneMsg && (
            <Alert tone={phoneMsg.tone} title={phoneMsg.tone === 'success' ? 'Saved' : 'Could not save'}>
              {phoneMsg.text}
            </Alert>
          )}
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone number</label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="block min-h-[2.75rem] w-full rounded-lg border border-gray-300 px-3 text-sm"
          />
          <Button onClick={savePhone} disabled={saving || phone.trim() === ''}>
            {saving ? 'Saving…' : 'Save number'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
