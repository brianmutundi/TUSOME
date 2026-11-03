'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { StudentReportCard } from '@/components/analytics/StudentReportCard';
import { Alert, Button, Card, EmptyState, LoadingPanel } from '@/components/ui';
import { describeAnalyticsError, getReportTemplateConfig, getStudentReportData, isAbortError } from '@/lib/analytics/api';
import { isUuid } from '@/lib/analytics/guards';
import type { StudentReportData } from '@/lib/analytics/types';

function StudentReportContent() {
  const params = useParams<{ studentId: string | string[] }>();
  const searchParams = useSearchParams();
  const studentId = Array.isArray(params?.studentId) ? params.studentId[0] : params?.studentId;
  const examId = searchParams.get('exam');

  const [report, setReport] = useState<StudentReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [orientation, setOrientation] = useState('portrait');

  const linkValid = isUuid(studentId) && isUuid(examId);

  useEffect(() => {
    if (!linkValid || !studentId || !examId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    setReport(null);

    getStudentReportData(studentId, examId, { signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setReport(data);
        document.title = `${data.student.name} · ${data.exam.name} · TUSOME`;
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load student report');
        setError(describeAnalyticsError(caught, 'Could not load this report.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
      document.title = 'TUSOME Analytics';
    };
  }, [studentId, examId, linkValid, reloadToken]);

  const retry = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    getReportTemplateConfig()
      .then((rows) => {
        const map: Record<string, string> = {};
        for (const r of rows) map[r.config_key] = r.config_value;
        if (map.report_orientation === 'landscape' || map.report_orientation === 'portrait') {
          setOrientation(map.report_orientation);
        }
      })
      .catch(() => {});
  }, []);

  const print = () => {
    setPrintNotice('Print dialog opened. Choose “Save as PDF” to download a copy.');
    window.print();
  };

  if (!linkValid) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card>
          <EmptyState
            title="This report link is incomplete"
            action={
              <Link
                href="/analytics"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Back to analytics
              </Link>
            }
          />
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/analytics" className="text-sm font-medium text-blue-700 hover:text-blue-900">
          ← Back to analytics
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={retry} disabled={loading}>
            Refresh
          </Button>
          <Button onClick={print} disabled={!report || loading}>
            Print / Save as PDF
          </Button>
        </div>
      </div>

      {printNotice && (
        <div className="mb-4 print:hidden">
          <Alert tone="info" title="Print">
            {printNotice}
          </Alert>
        </div>
      )}

      {loading ? (
        <Card>
          <LoadingPanel label="Loading student report…" />
        </Card>
      ) : error ? (
        <Alert
          tone="error"
          title="Could not load report"
          action={
            <Button variant="danger" size="sm" onClick={retry}>
              Retry
            </Button>
          }
        >
          <p>{error}</p>
          <p className="mt-2 text-xs">
            Reports are only available for students with marks in a published exam. If the exam was
            reopened, ask an administrator to publish it again.
          </p>
        </Alert>
      ) : report ? (
        <>
          <style>{`@page { size: A4 ${orientation}; margin: 16mm; } @media print { .no-print { display: none !important; } @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #6b7280; } }`}</style>
          <StudentReportCard report={report} />
        </>
      ) : (
        <Card>
          <EmptyState
            title="Report not available"
            action={
              <Button variant="secondary" onClick={retry}>
                Try again
              </Button>
            }
          />
        </Card>
      )}
    </main>
  );
}

export default function StudentReportPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <LoadingPanel label="Loading report…" />
        </main>
      }
    >
      <StudentReportContent />
    </Suspense>
  );
}
