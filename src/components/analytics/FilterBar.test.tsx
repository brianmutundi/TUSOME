import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';
import type { AnalyticsSelection, ClassOption, ExamOption, StreamOption } from '@/lib/analytics/types';

const exams: ExamOption[] = [
  {
    id: 'e2026',
    name: 'End Term',
    term: 'Term 1',
    academic_year: 2026,
    assessment_component: 'end_term',
    status: 'published',
    published_at: null,
  },
  {
    id: 'e2025',
    name: 'Mid Term',
    term: 'Term 2',
    academic_year: 2025,
    assessment_component: 'mid_term',
    status: 'published',
    published_at: null,
  },
];

const classes: ClassOption[] = [
  { id: 'c1', name: 'Form 2 East' },
  { id: 'c2', name: 'Form 2 West' },
];

const streams: StreamOption[] = [
  { id: 's1', class_id: 'c1', name: 'Blue' },
  { id: 's2', class_id: 'c1', name: 'Red' },
  { id: 's3', class_id: 'c2', name: 'North' },
];

const selection: AnalyticsSelection = {
  academicYear: '2026',
  examId: 'e2026',
  classId: 'c1',
  streamId: '',
};

function renderBar(overrides: Partial<ComponentProps<typeof FilterBar>> = {}) {
  const onChange = vi.fn();
  const onRefresh = vi.fn();
  render(
    <FilterBar
      years={['2026', '2025']}
      exams={exams}
      classes={classes}
      streams={streams}
      selection={selection}
      onChange={onChange}
      onRefresh={onRefresh}
      loading={false}
      {...overrides}
    />
  );
  return { onChange, onRefresh };
}

describe('FilterBar', () => {
  it('shows only exams for the selected year', () => {
    renderBar();
    const examSelect = screen.getByLabelText('Exam');
    expect(examSelect).toHaveTextContent('End Term');
    expect(examSelect).not.toHaveTextContent('Mid Term');
  });

  it('shows only streams for the selected class', () => {
    renderBar();
    const streamSelect = screen.getByLabelText('Stream');
    expect(streamSelect).toHaveTextContent('Blue');
    expect(streamSelect).toHaveTextContent('Red');
    expect(streamSelect).not.toHaveTextContent('North');
  });

  it('clears the stream when the class changes', async () => {
    const user = userEvent.setup();
    const { onChange } = renderBar();
    await user.selectOptions(screen.getByLabelText('Class'), 'c2');
    expect(onChange).toHaveBeenCalledWith({ classId: 'c2', streamId: '' });
  });

  it('clears the exam when the academic year changes', async () => {
    const user = userEvent.setup();
    const { onChange } = renderBar();
    await user.selectOptions(screen.getByLabelText('Academic year'), '2025');
    expect(onChange).toHaveBeenCalledWith({ academicYear: '2025', examId: '' });
  });

  it('calls Refresh and disables it while loading', async () => {
    const user = userEvent.setup();
    const { onRefresh } = renderBar();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables Refresh while loading', () => {
    renderBar({ loading: true });
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled();
  });

  it('enables Clear filters only when a class or stream is active', async () => {
    const user = userEvent.setup();
    const { onChange } = renderBar();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onChange).toHaveBeenCalledWith({ classId: '', streamId: '' });
  });

  it('disables Clear filters when no class/stream is active', () => {
    renderBar({ selection: { ...selection, classId: '', streamId: '' } });
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
  });

  it('shows a no-exams option when the year has no published exams', () => {
    renderBar({
      exams: exams.filter((exam) => exam.academic_year === 2025),
      selection: { ...selection, examId: '' },
    });
    expect(screen.getByLabelText('Exam')).toHaveTextContent('No published exams');
  });
});
