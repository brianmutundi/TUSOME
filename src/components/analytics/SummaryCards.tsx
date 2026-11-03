import { StatCard } from '@/components/ui';
import { formatNumber, formatPercent } from '@/lib/analytics/format';
import type { ClassPerformanceStudent, SubjectPerformance } from '@/lib/analytics/types';

export function SummaryCards({
  students,
  subjects,
}: {
  students: ClassPerformanceStudent[];
  subjects: SubjectPerformance[];
}) {
  const mean =
    students.length > 0
      ? students.reduce((sum, student) => sum + student.mean_percentage, 0) / students.length
      : 0;

  const withMarks = students.filter((student) => student.subjects_count > 0);
  const passedAll = withMarks.filter(
    (student) => student.passed_count >= student.subjects_count
  ).length;
  const passRate = withMarks.length > 0 ? (passedAll / withMarks.length) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Students"
        value={students.length}
        hint={students.length === 0 ? 'No marks for this selection' : 'With marks in this exam'}
      />
      <StatCard
        label="Subjects"
        value={subjects.length}
        hint={subjects.length === 0 ? 'No subject entries' : 'Subjects with marks'}
      />
      <StatCard
        label="Class mean"
        value={`${formatNumber(mean)}%`}
        hint={
          subjects.length > 0
            ? `Best subject: ${[...subjects].sort((a, b) => b.mean_score - a.mean_score)[0].subject_name}`
            : 'No subject averages'
        }
      />
      <StatCard
        label="Passing all subjects"
        value={`${formatPercent(passRate, 1)}`}
        hint={`${passedAll} of ${withMarks.length} students · pass mark 40 per subject`}
      />
    </div>
  );
}
