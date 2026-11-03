'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MarkSheetTable } from '@/components/analytics/MarkSheetTable';
import { Alert, Button, Card, EmptyState, LoadingPanel } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { describeAnalyticsError, getMarkSheet, isAbortError } from '@/lib/analytics/api';
import { isUuid } from '@/lib/analytics/guards';
import type { MarkSheetRow } from '@/lib/analytics/types';

function MarkSheetContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get('exam');
  const classId = searchParams.get('class') ?? undefined;
  const streamId = searchParams.get('stream') ?? undefined;

  const [rows, setRows] = useState<MarkSheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [downloading, setDownloading] = useState(false);

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
    setRows([]);

    getMarkSheet(examId, classId, streamId, { signal: controller.signal })
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load mark sheet');
        setError(describeAnalyticsError(caught, 'Could not load the mark sheet.'));
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

  const handleDownloadPdf = async () => {
    if (!linkValid || !examId) return;
    setDownloading(true);
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session expired. Sign in again.');
      const params = new URLSearchParams({ path: `/analytics/mark-sheet?exam=${examId}`, filename: 'mark-sheet.pdf' });
      const res = await fetch(`/api/pdf?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mark-sheet.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(describeAnalyticsError(caught, 'Could not download PDF.'));
    } finally {
      setDownloading(false);
    }
  };

  if (!linkValid) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Card>
          <EmptyState
            title="This mark sheet link is incomplete"
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
          <h1 className="text-2xl font-bold text-gray-900">Mark Sheet</h1>
          <p className="mt-1 text-sm text-gray-600">
            Student × subject marks for the selected published exam.
          </p>
        </div>
        <Button variant="secondary" onClick={retry} disabled={loading}>
          Refresh
        </Button>
        <Button variant="secondary" onClick={() => window.print()} disabled={loading}>
          Print / Save as PDF
        </Button>
        <Button variant="secondary" onClick={handleDownloadPdf} disabled={loading || downloading}>
          {downloading ? 'Generating…' : 'Download PDF'}
        </Button>
      </div>
      <style>{`@page { size: A4 landscape; margin: 16mm; } @media print { .no-print { display: none !important; } @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #6b7280; } }`}</style>

      {loading ? (
        <Card>
          <LoadingPanel label="Loading mark sheet…" />
        </Card>
      ) : error ? (
        <Alert
          tone="error"
          title="Could not load mark sheet"
          action={
            <Button variant="danger" size="sm" onClick={retry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : (
        <MarkSheetTable rows={rows} loading={false} error={null} examLabel={examId ?? undefined} />
      )}
    </main>
  );
}

export default function MarkSheetPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <LoadingPanel label="Loading mark sheet…" />
        </main>
      }
    >
      <MarkSheetContent />
    </Suspense>
  );
}
