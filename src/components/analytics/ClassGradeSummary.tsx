'use client';

import { useMemo } from 'react';
import { Card, CardHeader, EmptyState, StatCard } from '@/components/ui';
import { getClassGradeSummary } from '@/lib/analytics/markSheet';
import { formatNumber } from '@/lib/analytics/format';
import type { MarkSheetRow } from '@/lib/analytics/types';

export function ClassGradeSummary({
  className,
  streamName,
  markSheet,
}: {
  className: string | undefined;
  streamName?: string | null;
  markSheet: MarkSheetRow[];
}) {
  const summary = useMemo(() => {
    if (!className) return null;
    return getClassGradeSummary(markSheet, className, streamName || undefined);
  }, [className, streamName, markSheet]);

  return (
    <Card>
      <CardHeader
        title="Class Grade Summary"
        description={
          summary
            ? `${summary.total_students} student${summary.total_students === 1 ? '' : 's'} · ${summary.class_name}${summary.stream_name ? ` · ${summary.stream_name}` : ''}`
            : 'Select a class and exam to see the summary.'
        }
      />
      {!summary ? (
        <EmptyState
          title="No class selected"
          description="Choose an exam, class and stream to view the class grade summary."
        />
      ) : summary.total_students === 0 ? (
        <EmptyState
          title="No marks for this class"
          description="Pick another class or stream, or check that the exam has marks."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 p-4">
          <StatCard label="Students" value={summary.total_students} />
          <StatCard label="Mean score" value={`${formatNumber(summary.mean_score)}%`} />
          <StatCard label="Total marks" value={formatNumber(summary.total_marks)} />
          <StatCard label="Pass rate" value={`${formatNumber(summary.pass_rate)}%`} hint={`${summary.pass_count} passed`} />
        </div>
      )}
    </Card>
  );
}
