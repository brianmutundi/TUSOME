'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, TextField } from '@/components/ui';
import {
  closeFiscalPeriod,
  createFiscalPeriod,
  describeAnalyticsError,
  getFiscalPeriods,
  isAbortError,
  reopenFiscalPeriod,
} from '@/lib/analytics/api';
import type { FiscalPeriod } from '@/lib/analytics/types';

export default function FiscalPeriodsPage() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [reopenId, setReopenId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    getFiscalPeriods({ signal: controller.signal })
      .then((data) => { if (!active) return; setPeriods(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load fiscal periods.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formStart || !formEnd) { setActionError('Name, start and end dates required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createFiscalPeriod(formName.trim(), formStart, formEnd);
      setActionSuccess('Fiscal period created.');
      setShowForm(false);
      setFormName(''); setFormStart(''); setFormEnd('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create period.'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (periodId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await closeFiscalPeriod(periodId, 'Period closed');
      setActionSuccess('Period closed.');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not close period.'));
    }
  };

  const handleReopen = async (periodId: string) => {
    if (!reopenReason.trim()) { setActionError('Reopen reason is required.'); return; }
    setActionError(null);
    setActionSuccess(null);
    try {
      await reopenFiscalPeriod(periodId, reopenReason.trim());
      setActionSuccess('Period reopened.');
      setReopenId(null);
      setReopenReason('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not reopen period.'));
    }
  };

  if (loading) return <LoadingPanel label="Loading fiscal periods…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load fiscal periods">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Fiscal Periods
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Fiscal Periods</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage fiscal periods and control financial period locking.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Create Period'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Create Fiscal Period" />
          <form onSubmit={handleCreate} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="fp-name" label="Name" required placeholder="e.g. FY 2026" value={formName} onChange={(e) => setFormName(e.target.value)} />
              <TextField id="fp-start" label="Start Date" type="date" required value={formStart} onChange={(e) => setFormStart(e.target.value)} />
              <TextField id="fp-end" label="End Date" type="date" required value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Period'}</Button>
            </div>
          </form>
        </Card>
      )}

      {periods.length === 0 ? (
        <EmptyState title="No fiscal periods" description="Create your first fiscal period above." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Start</th>
                  <th scope="col" className="px-4 py-3">End</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Closed By</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {periods.map((p) => (
                  <tr key={p.period_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.start_date}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.end_date}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={p.status === 'open' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : p.status === 'closed' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-800'}>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{p.closed_by_name || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        {p.status === 'open' && (
                          <Button variant="secondary" onClick={() => handleClose(p.period_id)}>Close</Button>
                        )}
                        {p.status !== 'open' && (
                          <>
                            {reopenId === p.period_id ? (
                              <>
                                <TextField id="reopen-reason" label="Reason" placeholder="Reason for reopening" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
                                <Button variant="primary" onClick={() => handleReopen(p.period_id)}>Confirm Reopen</Button>
                              </>
                            ) : (
                              <Button variant="secondary" onClick={() => setReopenId(p.period_id)}>Reopen</Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
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
