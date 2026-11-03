'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Card, CardHeader, EmptyState, LoadingPanel, SelectField } from '@/components/ui';
import {
  describeAnalyticsError,
  getAuditEvents,
  isAbortError,
} from '@/lib/analytics/api';
import type { AuditEvent } from '@/lib/analytics/types';

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [entityType, setEntityType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    getAuditEvents(entityType || undefined, undefined, undefined, 100, { signal: controller.signal })
      .then((data) => { if (!active) return; setEvents(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load audit events.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [entityType]);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  if (loading) return <LoadingPanel label="Loading audit log…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load audit log">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Audit Log
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Audit Log</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">Immutable record of all financial and administrative actions.</p>
      </div>

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="audit-entity" label="Filter by Entity Type" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">All</option>
            <option value="fee_payment">Fee Payment</option>
            <option value="invoice">Invoice</option>
            <option value="receipt">Receipt</option>
            <option value="fee_waiver">Fee Waiver</option>
            <option value="journal_entry">Journal Entry</option>
            <option value="cash_book_entry">Cash Book Entry</option>
            <option value="wallet_transaction">Wallet Transaction</option>
            <option value="school">School</option>
            <option value="tenant">Tenant</option>
            <option value="account">Account</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
            <option value="class">Class</option>
            <option value="exam">Exam</option>
            <option value="purge_school">Purge School</option>
          </SelectField>
        </div>
      </Card>

      {events.length === 0 ? (
        <EmptyState title="No audit events" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Timestamp</th>
                  <th scope="col" className="px-4 py-3">Actor</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                  <th scope="col" className="px-4 py-3">Entity Type</th>
                  <th scope="col" className="px-4 py-3">Entity ID</th>
                  <th scope="col" className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {events.map((e) => (
                  <tr key={e.event_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs text-gray-600">{new Date(e.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-2.5 text-gray-700">{e.actor_name || 'System'}</td>
                    <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{e.action}</Badge></td>
                    <td className="px-4 py-2.5 text-gray-700">{e.entity_type}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{e.entity_id ? e.entity_id.slice(0, 8) + '…' : '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{e.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </main>
  );
}
