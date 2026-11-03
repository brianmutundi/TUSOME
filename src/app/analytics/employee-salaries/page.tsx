'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getEmployeeSalaries,
  getStaffDirectory,
  isAbortError,
  upsertEmployeeSalary,
} from '@/lib/analytics/api';
import type { EmployeeSalary, StaffDirectoryRow } from '@/lib/analytics/types';

export default function EmployeeSalariesPage() {
  const [staff, setStaff] = useState<StaffDirectoryRow[]>([]);
  const [salaries, setSalaries] = useState<EmployeeSalary[]>([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formBasic, setFormBasic] = useState('');
  const [formEffectiveFrom, setFormEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [formEffectiveTo, setFormEffectiveTo] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getStaffDirectory(undefined, { signal: controller.signal }),
      getEmployeeSalaries(undefined, { signal: controller.signal }),
    ])
      .then(([s, sal]) => {
        if (!active) return;
        setStaff(s);
        setSalaries(sal);
        if (s.length > 0) setSelectedStaff(s[0].staff_id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load data.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !formBasic) { setActionError('Staff and basic salary required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertEmployeeSalary(selectedStaff, Number(formBasic), formEffectiveFrom, formEffectiveTo || undefined);
      setActionSuccess('Salary assigned.');
      setShowForm(false);
      setFormBasic(''); setFormEffectiveTo('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not assign salary.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading employee salaries…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load employee salaries">{error}</Alert>
      </main>
    );
  }

  const staffSalaries = salaries.filter((s) => s.staff_id === selectedStaff);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Employee Salaries
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Employee Salary Assignment</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Assign and manage employee salaries.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Assign Salary'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="es-staff" label="Staff Member" value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
            {staff.map((s) => (<option key={s.staff_id} value={s.staff_id}>{s.full_name || s.email}</option>))}
          </SelectField>
        </div>
      </Card>

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Assign Salary" />
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField id="es-basic" label="Basic Salary" type="number" required value={formBasic} onChange={(e) => setFormBasic(e.target.value)} />
              <TextField id="es-from" label="Effective From" type="date" required value={formEffectiveFrom} onChange={(e) => setFormEffectiveFrom(e.target.value)} />
              <TextField id="es-to" label="Effective To" type="date" value={formEffectiveTo} onChange={(e) => setFormEffectiveTo(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Assign Salary'}</Button>
            </div>
          </form>
        </Card>
      )}

      {staffSalaries.length === 0 ? (
        <EmptyState title="No salary assignments" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Basic Salary</th>
                  <th scope="col" className="px-4 py-3">Effective From</th>
                  <th scope="col" className="px-4 py-3">Effective To</th>
                  <th scope="col" className="px-4 py-3">Components</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {staffSalaries.map((s) => (
                  <tr key={s.salary_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{s.basic_salary}</td>
                    <td className="px-4 py-2.5 text-gray-600">{s.effective_from}</td>
                    <td className="px-4 py-2.5 text-gray-600">{s.effective_to || 'Ongoing'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{s.component_count}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={s.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
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
