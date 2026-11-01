'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, Badge, Button, Card, CardHeader, LoadingPanel } from '@/components/ui';
import {
  describeAnalyticsError,
  getPayrollEntries,
  isAbortError,
  logAuditEvent,
} from '@/lib/analytics/api';
import type { PayrollEntry } from '@/lib/analytics/types';

function decodeParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return '';
  try { return decodeURIComponent(value); } catch { return value; }
}

export default function PayslipPage() {
  const params = useParams<{ periodId?: string | string[]; entryId?: string | string[] }>();
  const periodId = decodeParam(params?.periodId);
  const entryId = decodeParam(params?.entryId);
  const [entry, setEntry] = useState<PayrollEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!periodId || !entryId) { setLoading(false); setError('Missing parameters.'); return; }
    const controller = new AbortController();
    let active = true;
    getPayrollEntries(periodId, { signal: controller.signal })
      .then((data) => {
        if (!active) return;
        const found = data.find((e) => e.entry_id === entryId);
        if (found) setEntry(found);
        else setError('Payslip not found.');
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load payslip.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [periodId, entryId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      await logAuditEvent('reprint', 'payslip', entryId, undefined, undefined, 'Payslip print');
    } catch { /* ignore audit errors */ }
    window.print();
  };

  if (loading) return <LoadingPanel label="Loading payslip…" />;

  if (error || !entry) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load payslip">{error || 'Payslip not found.'}</Alert>
        <div className="mt-4">
          <Link href="/analytics/payroll" className="text-blue-700 hover:underline">Back to Payroll</Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="no-print mb-4 flex gap-2">
          <Button variant="primary" onClick={handlePrint}>Print Payslip</Button>
          <Link href="/analytics/payroll" className="text-blue-700 hover:underline text-sm self-center">Back to Payroll</Link>
        </div>

        <Card className="receipt-card">
          <div className="p-8">
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-gray-900">Payslip</h1>
              <p className="text-sm text-gray-500">Employee Payslip</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <p className="text-xs text-gray-500">Employee</p>
                <p className="font-bold text-gray-900">{entry.staff_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="font-medium text-gray-900">{entry.status}</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mb-4">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Earnings</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Basic Salary</span>
                <span className="font-medium text-gray-900">{entry.basic_salary.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Gross Earnings</span>
                <span className="font-bold text-gray-900">{entry.gross_earnings.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mb-4">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Deductions</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">PAYE</span>
                <span className="text-gray-900">{entry.paye.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">NSSF (Employee)</span>
                <span className="text-gray-900">{entry.nssf_employee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">SHA/SHIF</span>
                <span className="text-gray-900">{entry.sha_employee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">AHL (Employee)</span>
                <span className="text-gray-900">{entry.ahl_employee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold mt-2">
                <span className="text-gray-900">Total Deductions</span>
                <span className="text-red-700">{entry.total_deductions.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mb-4">
              <div className="flex justify-between text-lg font-bold">
                <span className="text-gray-900">Net Pay</span>
                <span className="text-emerald-700">{entry.net_pay.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 text-xs text-gray-400 text-center">
              <p>Employer Contributions: NSSF {entry.nssf_employer.toFixed(2)} + AHL {entry.ahl_employer.toFixed(2)}</p>
              <p className="mt-2">This is a computer-generated payslip.</p>
            </div>
          </div>
        </Card>
      </main>
    </>
  );
}
