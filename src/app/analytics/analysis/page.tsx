'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnalysisReportView } from '@/components/analytics/AnalysisReportView';
import { Alert, Button, Card, EmptyState, LoadingPanel } from '@/components/ui';
import {
  describeAnalyticsError,
  getMarkSheet,
  getMostImproved,
  isAbortError,
} from '@/lib/analytics/api';
import { isUuid } from '@/lib/analytics/guards';
import type { MarkSheetRow, MostImprovedRow } from '@/lib/analytics/types';

function AnalysisContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get('exam');
  const classId = searchParams.get('class') ?? undefined;
  const streamId = searchParams.get('stream') ?? undefined;

  const [markSheet, setMarkSheet] = useState<MarkSheetRow[]>([]);
  const [mostImproved, setMostImproved] = useState<MostImprovedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const linkValid = isUuid(examId);

  useEffect(() => {
    if (!linkValid || !examId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    setMarkSheet([]);
    setMostImproved([]);

    Promise.all([
      getMarkSheet(examId, classId, streamId, { signal: controller.signal }),
      getMostImproved(examId, classId, streamId, { signal: controller.signal }),
    ])
      .then(([rows, improved]) => {
        if (!active) return;
        setMarkSheet(rows);
        setMostImproved(improved);
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load analysis report');
        setError(describeAnalyticsError(caught, 'Could not load the analysis report.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [examId, classId, streamId, linkValid, reloadToken]);

  const retry = useCallback(() => setReloadToken((value) => value + 1), []);

  if (!linkValid) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Card>
          <EmptyState
            title="This analysis link is incomplete"
            description="Open the analysis report from the analytics dashboard so a published exam is included."
            action={
              <Button variant="secondary" onClick={retry}>
                Try again
              </Button>
            }
          />
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analysis Report</h1>
          <p className="mt-1 text-sm text-gray-600">
            Class average, subject breakdown, grade distribution and most improved students.
          </p>
        </div>
        <Button variant="secondary" onClick={retry} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card>
          <LoadingPanel label="Loading analysis report…" />
        </Card>
      ) : error ? (
        <Alert
          tone="error"
          title="Could not load analysis report"
          action={
            <Button variant="danger" size="sm" onClick={retry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : (
        <AnalysisReportView markSheet={markSheet} mostImproved={mostImproved} />
      )}
    </main>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <LoadingPanel label="Loading analysis report…" />
        </main>
      }
    >
      <AnalysisContent />
    </Suspense>
  );
}
