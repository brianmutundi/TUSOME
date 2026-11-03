'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Card, CardHeader, EmptyState, LoadingPanel } from '@/components/ui';
import {
  describeAnalyticsError,
  getMyChildAttendance,
  getMyChildFees,
  getMyChildPayments,
  getMyChildResults,
  isAbortError,
  type MyChildAttendanceCount,
  type MyChildFeeLine,
  type MyChildPayment,
  type MyChildResult,
} from '@/lib/analytics/api';
import { formatKes } from '@/lib/format-kes';

interface ChildData {
  fees: MyChildFeeLine[];
  payments: MyChildPayment[];
  results: MyChildResult[];
  attendance: MyChildAttendanceCount[];
}

export default function ChildPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;
  const [data, setData] = useState<ChildData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    setData(null);
    setError(null);
    Promise.all([
      getMyChildFees(studentId, opts),
      getMyChildPayments(studentId, 20, opts),
      getMyChildResults(studentId, opts),
      getMyChildAttendance(studentId, undefined, opts),
    ])
      .then(([fees, payments, results, attendance]) => setData({ fees, payments, results, attendance }))
      .catch((caught) => {
        if (isAbortError(caught)) return;
        setError(describeAnalyticsError(caught, 'Could not load this child.'));
      });
    return () => controller.abort();
  }, [studentId]);

  const owed = useMemo(
    () => (data ? data.fees.reduce((sum, line) => sum + Math.max(line.balance, 0), 0) : 0),
    [data]
  );

  const resultsByExam = useMemo(() => {
    const map = new Map<string, { name: string; term: string | null; year: number | null; rows: MyChildResult[] }>();
    for (const r of data?.results ?? []) {
      const entry = map.get(r.examId) ?? { name: r.examName, term: r.term, year: r.academicYear, rows: [] };
      entry.rows.push(r);
      map.set(r.examId, entry);
    }
    return Array.from(map.entries());
  }, [data]);

  if (error) {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="Could not load">{error}</Alert>
        <Link href="/parent" className="text-sm font-medium text-blue-700">Back to my children</Link>
      </div>
    );
  }
  if (!data) return <LoadingPanel label="Loading…" />;

  return (
    <div className="space-y-6">
      <Link href="/parent" className="text-sm font-medium text-blue-700">← My children</Link>

      <Card>
        <CardHeader title="Fees" />
        <div className="px-5 py-4">
          <p className="text-sm text-gray-500">Total owed</p>
          <p className="text-3xl font-bold text-gray-900">{formatKes(owed)}</p>
          <div className="mt-3">
            <Button disabled title="Online payment is being added">Pay with M-Pesa (coming soon)</Button>
          </div>
        </div>
        {data.fees.length === 0 ? (
          <EmptyState title="No fee balances recorded" />
        ) : (
          <ul className="divide-y divide-gray-100 border-t border-gray-100">
            {data.fees.map((f) => (
              <li key={f.voteHeadId} className="flex justify-between gap-3 px-5 py-3 text-sm">
                <span className="text-gray-700">{f.voteHeadName}</span>
                <span className="font-medium text-gray-900">{formatKes(f.balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Payments" />
        {data.payments.length === 0 ? (
          <EmptyState title="No payments yet" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.payments.map((p) => (
              <li key={p.collectionId} className="flex justify-between gap-3 px-5 py-3 text-sm">
                <span className="text-gray-700">
                  {new Date(p.collectedAt).toLocaleDateString('en-KE')}
                  {p.referenceNumber ? ` · ${p.referenceNumber}` : ''}
                </span>
                <span className="font-medium text-gray-900">{formatKes(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Results" />
        {resultsByExam.length === 0 ? (
          <EmptyState title="No published results yet" />
        ) : (
          resultsByExam.map(([examId, exam]) => (
            <div key={examId} className="border-t border-gray-100 first:border-t-0">
              <p className="px-5 pt-4 text-sm font-semibold text-gray-900">
                {exam.name}
                <span className="font-normal text-gray-500">
                  {exam.term ? ` · ${exam.term}` : ''}
                  {exam.year ? ` ${exam.year}` : ''}
                </span>
              </p>
              <ul className="divide-y divide-gray-50 pb-2">
                {exam.rows.map((r) => (
                  <li key={`${examId}-${r.subjectName}`} className="flex justify-between gap-3 px-5 py-2 text-sm">
                    <span className="text-gray-700">{r.subjectName}</span>
                    <span className="font-medium text-gray-900">{r.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Card>

      <Card>
        <CardHeader title="Attendance" />
        {data.attendance.length === 0 ? (
          <EmptyState title="No attendance recorded" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.attendance.map((a) => (
              <li key={a.status} className="flex justify-between gap-3 px-5 py-3 text-sm capitalize">
                <span className="text-gray-700">{a.status}</span>
                <span className="font-medium text-gray-900">{a.days}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
