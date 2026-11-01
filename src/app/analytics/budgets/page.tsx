'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  approveBudget,
  createBudget,
  describeAnalyticsError,
  getBudgetVsActual,
  getBudgets,
  getFiscalPeriods,
  isAbortError,
} from '@/lib/analytics/api';
import type { Budget, BudgetVsActual, FiscalPeriod } from '@/lib/analytics/types';

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [selectedBudget, setSelectedBudget] = useState('');
  const [vsActual, setVsActual] = useState<BudgetVsActual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPeriod, setFormPeriod] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getBudgets(undefined, { signal: controller.signal }),
      getFiscalPeriods({ signal: controller.signal }),
    ])
      .then(([b, p]) => {
        if (!active) return;
        setBudgets(b);
        setPeriods(p);
        if (b.length > 0) setSelectedBudget(b[0].budget_id);
        if (p.length > 0) setFormPeriod(p[0].period_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load budgets.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  useEffect(() => {
    if (!selectedBudget) { setVsActual([]); return; }
    const controller = new AbortController();
    let active = true;
    getBudgetVsActual(selectedBudget, undefined, undefined, { signal: controller.signal })
      .then((data) => { if (!active) return; setVsActual(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load budget vs actual.')); });
    return () => { active = false; controller.abort(); };
  }, [selectedBudget]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { setActionError('Name is required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createBudget(formName.trim(), formPeriod || undefined, formDesc.trim() || undefined);
      setActionSuccess('Budget created.');
      setShowForm(false);
      setFormName(''); setFormDesc('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create budget.'));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (budgetId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await approveBudget(budgetId);
      setActionSuccess('Budget approved.');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not approve budget.'));
    }
  };

  if (loading) return <LoadingPanel label="Loading budgets…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load budgets">{error}</Alert>
      </main>
    );
  }

  const totalBudget = vsActual.reduce((s, r) => s + r.budget_amount, 0);
  const totalActual = vsActual.reduce((s, r) => s + r.actual_amount, 0);
  const totalVariance = totalBudget - totalActual;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Budgets
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Budgets vs Actual</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Compare approved budgets against actual expenditure.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Create Budget'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Create Budget" />
          <form onSubmit={handleCreate} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="bud-name" label="Name" required value={formName} onChange={(e) => setFormName(e.target.value)} />
              <SelectField id="bud-period" label="Fiscal Period" value={formPeriod} onChange={(e) => setFormPeriod(e.target.value)}>
                {periods.map((p) => (<option key={p.period_id} value={p.period_id}>{p.name}</option>))}
              </SelectField>
              <TextField id="bud-desc" label="Description" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Budget'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="bud-select" label="Budget" value={selectedBudget} onChange={(e) => setSelectedBudget(e.target.value)}>
            {budgets.map((b) => (<option key={b.budget_id} value={b.budget_id}>{b.name} ({b.status})</option>))}
          </SelectField>
        </div>
      </Card>

      {selectedBudget && (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Total Budget</p><p className="text-2xl font-bold text-gray-900">{totalBudget}</p></div></Card>
            <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Total Actual</p><p className="text-2xl font-bold text-blue-700">{totalActual}</p></div></Card>
            <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Variance</p><p className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{totalVariance}</p></div></Card>
          </div>

          {vsActual.length === 0 ? (
            <EmptyState title="No budget lines" description="Add budget lines to this budget." />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Account</th>
                      <th scope="col" className="px-4 py-3">Vote Head</th>
                      <th scope="col" className="px-4 py-3">Type</th>
                      <th scope="col" className="px-4 py-3">Budget</th>
                      <th scope="col" className="px-4 py-3">Actual</th>
                      <th scope="col" className="px-4 py-3">Variance</th>
                      <th scope="col" className="px-4 py-3">Variance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {vsActual.map((r) => (
                      <tr key={r.line_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-700">{r.account_code ? `${r.account_code} - ${r.account_name}` : '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{r.vote_head_name || '—'}</td>
                        <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{r.budget_type}</Badge></td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{r.budget_amount}</td>
                        <td className="px-4 py-2.5 text-gray-700">{r.actual_amount}</td>
                        <td className={`px-4 py-2.5 font-medium ${r.variance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{r.variance}</td>
                        <td className="px-4 py-2.5 text-gray-600">{r.variance_pct != null ? `${r.variance_pct}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Budget list */}
      {budgets.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Budgets" description={`${budgets.length} budget(s)`} />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Period</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Total</th>
                  <th scope="col" className="px-4 py-3">Lines</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {budgets.map((b) => (
                  <tr key={b.budget_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{b.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{b.fiscal_period_name || '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={b.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : b.status === 'submitted' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>{b.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{b.total_budget}</td>
                    <td className="px-4 py-2.5 text-gray-700">{b.line_count}</td>
                    <td className="px-4 py-2.5">
                      {b.status === 'submitted' && (
                        <Button variant="primary" onClick={() => handleApprove(b.budget_id)}>Approve</Button>
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
