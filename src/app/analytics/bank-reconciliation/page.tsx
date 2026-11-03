'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, TextField } from '@/components/ui';
import {
  completeReconciliation,
  createBankStatement,
  describeAnalyticsError,
  getBankStatements,
  getBankStatementLines,
  isAbortError,
  matchBankLine,
  unmatchBankLine,
} from '@/lib/analytics/api';
import type { BankStatement, BankStatementLine } from '@/lib/analytics/types';

export default function BankReconciliationPage() {
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [selectedStatement, setSelectedStatement] = useState('');
  const [lines, setLines] = useState<BankStatementLine[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formAccount, setFormAccount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formBank, setFormBank] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    getBankStatements({ signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setStatements(data);
        if (data.length > 0) setSelectedStatement(data[0].statement_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load statements.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const loadLines = useCallback(() => {
    if (!selectedStatement) { setLines([]); return; }
    const controller = new AbortController();
    let active = true;
    getBankStatementLines(selectedStatement, filterStatus || undefined, { signal: controller.signal })
      .then((data) => { if (!active) return; setLines(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load lines.')); });
    return () => { active = false; controller.abort(); };
  }, [selectedStatement, filterStatus]);

  useEffect(() => { const cleanup = loadLines(); return cleanup; }, [loadLines]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAccount.trim() || !formDate) { setActionError('Account name and date required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createBankStatement(formAccount.trim(), formDate, formBank.trim() || undefined);
      setActionSuccess('Statement created.');
      setShowForm(false);
      setFormAccount(''); setFormBank('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create statement.'));
    } finally {
      setSaving(false);
    }
  };

  const handleMatch = async (lineId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await matchBankLine(lineId, undefined, undefined, 'Manual match');
      setActionSuccess('Line matched.');
      loadLines();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not match line.'));
    }
  };

  const handleUnmatch = async (lineId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await unmatchBankLine(lineId, 'Manual unmatch');
      setActionSuccess('Line unmatched.');
      loadLines();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not unmatch line.'));
    }
  };

  const handleComplete = async () => {
    if (!selectedStatement) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await completeReconciliation(selectedStatement);
      setActionSuccess('Reconciliation completed.');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not complete reconciliation.'));
    }
  };

  if (loading) return <LoadingPanel label="Loading bank reconciliation…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load bank reconciliation">{error}</Alert>
      </main>
    );
  }

  const selectedStmt = statements.find((s) => s.statement_id === selectedStatement);
  const matchedTotal = lines.filter((l) => l.match_status === 'matched').reduce((s, l) => s + l.amount, 0);
  const unmatchedTotal = lines.filter((l) => l.match_status === 'unmatched').reduce((s, l) => s + l.amount, 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Bank Reconciliation
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Bank Reconciliation</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Import bank statements and reconcile against payments.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Import Statement'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Import Bank Statement" />
          <form onSubmit={handleCreate} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField id="bs-account" label="Account Name" required value={formAccount} onChange={(e) => setFormAccount(e.target.value)} />
              <TextField id="bs-bank" label="Bank Name" value={formBank} onChange={(e) => setFormBank(e.target.value)} />
              <TextField id="bs-date" label="Statement Date" type="date" required value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Importing…' : 'Import Statement'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="mb-6">
        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Statement</label>
              <select value={selectedStatement} onChange={(e) => setSelectedStatement(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                {statements.map((s) => (<option key={s.statement_id} value={s.statement_id}>{s.account_name} - {s.statement_date} ({s.status})</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Filter by Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                <option value="">All</option>
                <option value="matched">Matched</option>
                <option value="unmatched">Unmatched</option>
                <option value="duplicate">Duplicate</option>
                <option value="ambiguous">Ambiguous</option>
              </select>
            </div>
          </div>
          {selectedStmt && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <span className="text-gray-600">Lines: <strong>{selectedStmt.line_count}</strong></span>
              <span className="text-gray-600">Matched: <strong className="text-emerald-700">{selectedStmt.matched_count}</strong></span>
              <span className="text-gray-600">Unmatched: <strong className="text-red-700">{selectedStmt.unmatched_count}</strong></span>
              <span className="text-gray-600">Matched Total: <strong>{matchedTotal}</strong></span>
              <span className="text-gray-600">Unmatched Total: <strong>{unmatchedTotal}</strong></span>
              <Button variant="secondary" onClick={handleComplete} disabled={selectedStmt.status === 'completed'}>Complete Reconciliation</Button>
            </div>
          )}
        </div>
      </Card>

      {lines.length === 0 ? (
        <EmptyState title="No statement lines" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Description</th>
                  <th scope="col" className="px-4 py-3">Reference</th>
                  <th scope="col" className="px-4 py-3">Debit</th>
                  <th scope="col" className="px-4 py-3">Credit</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {lines.map((l) => (
                  <tr key={l.line_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600">{l.transaction_date}</td>
                    <td className="px-4 py-2.5 text-gray-700">{l.description || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{l.reference_number || '—'}</td>
                    <td className="px-4 py-2.5 text-red-700">{l.debit > 0 ? l.debit : '—'}</td>
                    <td className="px-4 py-2.5 text-emerald-700">{l.credit > 0 ? l.credit : '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={l.match_status === 'matched' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : l.is_duplicate ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>{l.match_status}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {l.match_status === 'unmatched' && (
                        <Button variant="secondary" onClick={() => handleMatch(l.line_id)}>Match</Button>
                      )}
                      {l.match_status === 'matched' && (
                        <Button variant="secondary" onClick={() => handleUnmatch(l.line_id)}>Unmatch</Button>
                      )}
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
