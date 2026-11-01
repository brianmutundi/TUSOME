'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getSalaryComponents,
  isAbortError,
  upsertSalaryComponent,
} from '@/lib/analytics/api';
import type { SalaryComponent } from '@/lib/analytics/types';

export default function SalaryComponentsPage() {
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('earning');
  const [formCalcType, setFormCalcType] = useState('fixed');
  const [formAmount, setFormAmount] = useState('');
  const [formRate, setFormRate] = useState('');
  const [formStatutory, setFormStatutory] = useState('none');
  const [formTaxable, setFormTaxable] = useState(true);
  const [formPensionable, setFormPensionable] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    getSalaryComponents({ signal: controller.signal })
      .then((data) => { if (!active) return; setComponents(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load salary components.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { setActionError('Name is required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertSalaryComponent(
        formName.trim(),
        formType,
        formCalcType,
        formAmount ? Number(formAmount) : undefined,
        formRate ? Number(formRate) : undefined,
        formTaxable,
        formPensionable,
        formStatutory
      );
      setActionSuccess('Salary component saved.');
      setShowForm(false);
      setFormName(''); setFormAmount(''); setFormRate('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save component.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading salary components…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load salary components">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Salary Components
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Salary Components</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage salary components, statutory deductions, and allowances.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Component'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Add Salary Component" />
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField id="sc-name" label="Name" required value={formName} onChange={(e) => setFormName(e.target.value)} />
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="earning">Earning</option>
                  <option value="deduction">Deduction</option>
                  <option value="employer_contribution">Employer Contribution</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Calculation</label>
                <select value={formCalcType} onChange={(e) => setFormCalcType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Statutory Type</label>
                <select value={formStatutory} onChange={(e) => setFormStatutory(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="none">None</option>
                  <option value="paye">PAYE</option>
                  <option value="nssf">NSSF</option>
                  <option value="sha">SHA/SHIF</option>
                  <option value="ahl">AHL</option>
                </select>
              </div>
              <TextField id="sc-amount" label="Default Amount" type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
              <TextField id="sc-rate" label="Percentage Rate" type="number" step="0.01" value={formRate} onChange={(e) => setFormRate(e.target.value)} />
              <div className="flex items-center gap-2">
                <input type="checkbox" id="sc-taxable" checked={formTaxable} onChange={(e) => setFormTaxable(e.target.checked)} />
                <label htmlFor="sc-taxable" className="text-sm text-gray-700">Taxable</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="sc-pensionable" checked={formPensionable} onChange={(e) => setFormPensionable(e.target.checked)} />
                <label htmlFor="sc-pensionable" className="text-sm text-gray-700">Pensionable</label>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Component'}</Button>
            </div>
          </form>
        </Card>
      )}

      {components.length === 0 ? (
        <EmptyState title="No salary components" description="Create your first salary component above." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Calculation</th>
                  <th scope="col" className="px-4 py-3">Amount/Rate</th>
                  <th scope="col" className="px-4 py-3">Statutory</th>
                  <th scope="col" className="px-4 py-3">Taxable</th>
                  <th scope="col" className="px-4 py-3">Pensionable</th>
                  <th scope="col" className="px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {components.map((c) => (
                  <tr key={c.component_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{c.component_type}</Badge></td>
                    <td className="px-4 py-2.5 text-gray-700">{c.calculation_type}</td>
                    <td className="px-4 py-2.5 text-gray-700">{c.calculation_type === 'percentage' ? `${c.percentage_rate}%` : c.default_amount ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{c.statutory_type}</td>
                    <td className="px-4 py-2.5">{c.is_taxable ? '✓' : '—'}</td>
                    <td className="px-4 py-2.5">{c.is_pensionable ? '✓' : '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={c.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
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
