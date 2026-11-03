'use client';

import { Info, RefreshCw, X } from 'lucide-react';
import { Popover } from '@/components/popover';
import { Button, SelectField } from '@/components/ui';
import { examsForYear, streamsForClass } from '@/lib/analytics/filters';
import type {
  AnalyticsSelection,
  ClassOption,
  ExamOption,
  StreamOption,
} from '@/lib/analytics/types';

export function FilterBar({
  years,
  exams,
  classes,
  streams,
  selection,
  onChange,
  onRefresh,
  loading,
}: {
  years: string[];
  exams: ExamOption[];
  classes: ClassOption[];
  streams: StreamOption[];
  selection: AnalyticsSelection;
  onChange: (next: Partial<AnalyticsSelection>) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  const visibleExams = examsForYear(exams, selection.academicYear);
  const visibleStreams = streamsForClass(streams, selection.classId);
  const examDisabled = loading || visibleExams.length === 0;

  return (
    <section
      aria-label="Analytics filters"
      className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          id="filter-year"
          label="Academic year"
          value={selection.academicYear}
          disabled={loading || years.length === 0}
          onChange={(event) => onChange({ academicYear: event.target.value, examId: '' })}
        >
          {years.length === 0 && <option value="">No years</option>}
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="filter-exam"
          label="Exam"
          value={selection.examId}
          disabled={examDisabled}
          onChange={(event) => onChange({ examId: event.target.value })}
        >
          {visibleExams.length === 0 && <option value="">No published exams</option>}
          {visibleExams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.name}
              {exam.term ? ` · ${exam.term}` : ''}
              {exam.assessment_component ? ` · ${exam.assessment_component}` : ''}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="filter-class"
          label="Class"
          value={selection.classId}
          disabled={loading}
          onChange={(event) => onChange({ classId: event.target.value, streamId: '' })}
        >
          <option value="">All classes</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="filter-stream"
          label="Stream"
          value={selection.streamId}
          disabled={loading || visibleStreams.length === 0}
          onChange={(event) => onChange({ streamId: event.target.value })}
        >
          <option value="">All streams</option>
          {visibleStreams.map((stream) => (
            <option key={stream.id} value={stream.id}>
              {stream.name}
            </option>
          ))}
        </SelectField>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onRefresh} disabled={loading}>
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onChange({ classId: '', streamId: '' })}
            disabled={loading || (!selection.classId && !selection.streamId)}
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Clear filters
          </Button>
          <Popover
            label="How rankings are calculated"
            align="end"
            trigger={({ props }) => (
              <button
                {...props}
                type="button"
                aria-label="How rankings are calculated"
                className="grid h-11 w-11 place-items-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <Info aria-hidden="true" className="h-5 w-5" />
              </button>
            )}
            className="w-72 p-4"
          >
            <p className="text-sm font-semibold text-gray-900">About positions</p>
            <p className="mt-1 text-sm text-gray-600">
              Positions are calculated within the current selection. Changing the class or stream
              re-ranks the filtered students.
            </p>
          </Popover>
        </div>
      </div>
    </section>
  );
}
