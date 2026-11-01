'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  approvePayroll,
  createPayrollPeriod,
  describeAnalyticsError,
  finalizePayroll,
  generatePayroll,
  getPayrollEntries,
  getPayrollPeriods,
  isAbortError,
} from '@/lib/analytics/api';
import type { PayrollEntry, PayrollPeriod } from '@/lib/analytics/types';

export default function PayrollPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    getPayrollPeriods({ signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setPeriods(data);
        if (data.length > 0) setSelectedPeriod(data[0].period_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load payroll.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  useEffect(() => {
    if (!selectedPeriod) { setEntries([]); return; }
    const controller = new AbortController();
    let active = true;
    getPayrollEntries(selectedPeriod, { signal: controller.signal })
      .then((data) => { if (!active) return; setEntries(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load entries.')); });
    return () => { active = false; controller.abort(); };
  }, [selectedPeriod]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formStart || !formEnd) { setActionError('Name and dates required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createPayrollPeriod(formName.trim(), formStart, formEnd);
      setActionSuccess('Payroll period created.');
      setShowForm(false);
      setFormName(''); setFormStart(''); setFormEnd('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create period.'));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedPeriod) return;
    setGenerating(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const count = await generatePayroll(selectedPeriod);
      setActionSuccess(`Generated ${count} payroll entries.`);
      const data = await getPayrollEntries(selectedPeriod);
      setEntries(data);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not generate payroll.'));
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedPeriod) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await approvePayroll(selectedPeriod);
      setActionSuccess('Payroll approved.');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not approve payroll.'));
    }
  };

  const handleFinalize = async () => {
    if (!selectedPeriod) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await finalizePayroll(selectedPeriod);
      setActionSuccess('Payroll finalized.');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not finalize payroll.'));
    }
  };

  if (loading) return <LoadingPanel label="Loading payroll…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load payroll">{error}</Alert>
      </main>
    );
  }

  const selectedPeriodObj = periods.find((p) => p.period_id === selectedPeriod);
  const totalGross = entries.reduce((s, e) => s + e.gross_earnings, 0);
  const totalNet = entries.reduce((s, e) => s + e.net_pay, 0);
  const totalDeductions = entries.reduce((s, e) => s + e.total_deductions, 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Payroll
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Payroll</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage payroll periods, generate payslips, and process statutory deductions.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Create Period'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Create Payroll Period" />
          <form onSubmit={handleCreate} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="pp-name" label="Name" required value={formName} onChange={(e) => setFormName(e.target.value)} />
              <TextField id="pp-start" label="Start Date" type="date" required value={formStart} onChange={(e) => setFormStart(e.target.value)} />
              <TextField id="pp-end" label="End Date" type="date" required value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Period'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="pp-select" label="Payroll Period" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
            {periods.map((p) => (<option key={p.period_id} value={p.period_id}>{p.name} ({p.status})</option>))}
          </SelectField>
        </div>
      </Card>

      {selectedPeriod && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge className="border-blue-200 bg-blue-50 text-blue-800">Status: {selectedPeriodObj?.status}</Badge>
            <Button variant="secondary" onClick={() => {
              const csv = ['Staff,Basic,Gross,PAYE,NSSF,SHA,AHL,Deductions,Net Pay,Status', ...entries.map(e => `${e.staff_name || ''},${e.basic_salary},${e.gross_earnings},${e.paye},${e.nssf_employee},${e.sha_employee},${e.ahl_employee},${e.total_deductions},${e.net_pay},${e.status}`)].join('\\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `payroll-${selectedPeriodObj?.name || 'export'}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}>Export CSV</Button>
            <Button variant="primary" onClick={handleGenerate} disabled={generating || selectedPeriodObj?.status !== 'draft'}>
              {generating ? 'Generating…' : 'Generate Payroll'}
            </Button>
            <Button variant="secondary" onClick={handleApprove} disabled={selectedPeriodObj?.status !== 'reviewed'}>Approve</Button>
            <Button variant="secondary" onClick={handleFinalize} disabled={selectedPeriodObj?.status !== 'approved'}>Finalize</Button>
          </div>

          {entries.length > 0 && (
            <>
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Total Gross</p><p className="text-2xl font-bold text-gray-900">{totalGross.toFixed(2)}</p></div></Card>
                <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Total Deductions</p><p className="text-2xl font-bold text-red-700">{totalDeductions.toFixed(2)}</p></div></Card>
                <Card><div className="p-5 text-center"><p className="text-xs text-gray-500">Total Net Pay</p><p className="text-2xl font-bold text-emerald-700">{totalNet.toFixed(2)}</p></div></Card>
              </div>

              <Card>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                      <tr>
                        <th scope="col" className="px-4 py-3">Staff</th>
                        <th scope="col" className="px-4 py-3">Basic</th>
                        <th scope="col" className="px-4 py-3">Gross</th>
                        <th scope="col" className="px-4 py-3">PAYE</th>
                        <th scope="col" className="px-4 py-3">NSSF</th>
                        <th scope="col" className="px-4 py-3">SHA</th>
                        <th scope="col" className="px-4 py-3">AHL</th>
                        <th scope="col" className="px-4 py-3">Deductions</th>
                        <th scope="col" className="px-4 py-3">Net Pay</th>
                        <th scope="col" className="px-4 py-3">Status</th>
                        <th scope="col" className="px-4 py-3">Payslip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {entries.map((e) => (
                        <tr key={e.entry_id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-900">{e.staff_name || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-700">{e.basic_salary.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-gray-700">{e.gross_earnings.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-gray-700">{e.paye.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-gray-700">{e.nssf_employee.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-gray-700">{e.sha_employee.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-gray-700">{e.ahl_employee.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-red-700">{e.total_deductions.toFixed(2)}</td>
                          <td className="px-4 py-2.5 font-bold text-emerald-700">{e.net_pay.toFixed(2)}</td>
                          <td className="px-4 py-2.5">
                            <Badge className={e.status === 'finalized' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>{e.status}</Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <Link href={`/analytics/payslips/${selectedPeriod}/${e.entry_id}`} className="text-blue-700 hover:underline text-xs">Payslip</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </main>
  );
}
