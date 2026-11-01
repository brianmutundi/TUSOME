import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { gradeBadgeClass } from '@/lib/analytics/format';
import type { GradeDistribution } from '@/lib/analytics/types';

export function GradeDistributionChart({ grades }: { grades: GradeDistribution[] }) {
  const total = grades.reduce((sum, grade) => sum + grade.count, 0);

  return (
    <Card>
      <CardHeader
        title="Grade distribution"
        description={
          total > 0 ? `${total} graded students in this selection` : 'Student overall grades'
        }
      />
      {grades.length === 0 ? (
        <EmptyState
          title="No grades to show"
          description="Grades appear once students in this selection have marks for the exam."
        />
      ) : (
        <div className="space-y-3 p-5">
          {grades.map((grade) => {
            const width = Math.max(0, Math.min(100, grade.percentage));
            return (
              <div key={grade.grade_code} className="grid grid-cols-[3.5rem_1fr_4.5rem] items-center gap-3">
                <Badge className={gradeBadgeClass(grade.grade_code)} title={grade.grade_name}>
                  {grade.grade_code}
                </Badge>
                <div
                  className="h-6 overflow-hidden rounded-full bg-gray-100"
                  role="img"
                  aria-label={`${grade.grade_name}: ${grade.count} students, ${grade.percentage}%`}
                >
                  <div
                    className="flex h-full items-center justify-end rounded-full px-2 text-[11px] font-semibold text-white"
                    style={{
                      width: `${width}%`,
                      minWidth: grade.count > 0 ? '1.75rem' : 0,
                      backgroundColor: /^#[0-9a-f]{3,8}$/i.test(grade.color ?? '')
                        ? grade.color
                        : '#6b7280',
                    }}
                  >
                    {grade.count}
                  </div>
                </div>
                <span className="text-right text-sm tabular-nums text-gray-700">
                  {grade.percentage.toFixed(1)}%
                </span>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
            {grades.map((grade) => (
              <span key={grade.grade_code}>
                <strong className="font-semibold text-gray-700">{grade.grade_code}</strong>{' '}
                {grade.grade_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
