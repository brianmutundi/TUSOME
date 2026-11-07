import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { gradeBadgeClass } from '@/lib/analytics/format';
import type { GradeDistribution } from '@/lib/analytics/types';

/**
 * Grade colours come from the database, so the label colour cannot be fixed:
 * white text on a pale grade tint fails 1.4.3. Pick the higher-contrast pole.
 */
function readableOn(hex: string | null | undefined): '#ffffff' | '#1c1b17' {
  const normalise = (value: string | undefined) => {
    if (!value) return null;
    const short = /^#([0-9a-f]{3})$/i.exec(value);
    if (short) return short[1].split('').map((c) => c + c).join('');
    const full = /^#([0-9a-f]{6})$/i.exec(value);
    return full ? full[1] : null;
  };
  const rgb = normalise(hex ?? undefined);
  if (!rgb) return '#ffffff';

  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(rgb.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const onWhite = 1.05 / (luminance + 0.05);
  const onInk = (luminance + 0.05) / 0.05;
  return onWhite >= onInk ? '#ffffff' : '#1c1b17';
}

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
                    aria-hidden="true"
                    className="flex h-full items-center justify-end rounded-full px-2 text-xs font-semibold"
                    style={{
                      width: `${width}%`,
                      minWidth: grade.count > 0 ? '1.75rem' : 0,
                      backgroundColor: /^#[0-9a-f]{3,8}$/i.test(grade.color ?? '')
                        ? grade.color
                        : '#6b7280',
                      color: readableOn(grade.color),
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
