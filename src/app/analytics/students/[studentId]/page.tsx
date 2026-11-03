'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { Popover, menuItemClass } from '@/components/popover';
import { ProfileCard } from '@/components/profile';
import { EditStudentModal, StudentRecordPanels } from '@/components/analytics/StudentRecordPanels';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel } from '@/components/ui';
import {
  describeAnalyticsError,
  getStudentExamHistory,
  getStudentProfile,
  isAbortError,
} from '@/lib/analytics/api';
import { isUuid } from '@/lib/analytics/guards';
import type { StudentProfileData } from '@/lib/analytics/types';

function decodeParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function StudentProfilePage() {
  const params = useParams<{ studentId?: string | string[] }>();
  const studentId = decodeParam(params?.studentId);
  const validStudentId = isUuid(studentId);

  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [examHistory, setExamHistory] = useState<
    Array<{
      exam_id: string;
      exam_name: string;
      term: string | null;
      academic_year: number | null;
      assessment_component: string | null;
      total_score: number;
      mean_score: number;
      subjects_count: number;
      overall_grade: string | null;
      overall_points: number | null;
      position: number;
      total_in_exam: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!validStudentId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getStudentProfile(studentId, { signal: controller.signal }),
      getStudentExamHistory(studentId, { signal: controller.signal }),
    ])
      .then(([profileData, historyData]) => {
        if (!active) return;
        setProfile(profileData);
        setExamHistory(historyData);
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load student profile');
        setError(describeAnalyticsError(caught, 'Could not load student profile.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [studentId, validStudentId, reloadToken]);

  const refresh = useCallback(() => setReloadToken((v) => v + 1), []);

  const latestEnrollment = useMemo(() => {
    if (!profile || profile.enrollments.length === 0) return null;
    return profile.enrollments[0];
  }, [profile]);

  if (!validStudentId) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Invalid student link">
          The student identifier in this URL is not a valid UUID.
        </Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
        <Link href="/analytics/students" className="text-blue-700 hover:underline">
          Student Directory
        </Link>{' '}
        / {profile?.full_name ?? 'Student Profile'}
      </p>

      <Card className="mb-6 p-5">
        <ProfileCard
          size="lg"
          name={profile?.full_name ?? 'Student Profile'}
          subtitle={profile ? `Admission no. ${profile.admission_no}` : undefined}
          meta={
            profile
              ? [
                  { label: 'Class', value: latestEnrollment?.class_name ?? '—' },
                  { label: 'Stream', value: latestEnrollment?.stream_name ?? '—' },
                  { label: 'Gender', value: profile.gender ?? '—' },
                  ...(profile.pathway ? [{ label: 'Pathway', value: profile.pathway }] : []),
                ]
              : undefined
          }
          actions={
            <>
              {profile && (
                <>
                  <Popover
                    label="Student records"
                    align="end"
                    role="menu"
                    trigger={({ props, open }) => (
                      <button
                        {...props}
                        type="button"
                        data-open={open || undefined}
                        className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 data-[open]:bg-gray-50"
                      >
                        Records
                        <ChevronDown aria-hidden="true" className="h-4 w-4 text-gray-500" />
                      </button>
                    )}
                    className="w-56 p-1.5"
                  >
                    {[
                      ['Report card', `/analytics/report/${encodeURIComponent(profile.student_id)}`],
                      ['Transcript', `/analytics/transcript/${encodeURIComponent(profile.student_id)}`],
                      ['Performance analytics', `/analytics/student/${encodeURIComponent(profile.student_id)}`],
                    ].map(([label, href]) => (
                      <Link key={href} href={href} role="menuitem" className={menuItemClass}>
                        {label}
                      </Link>
                    ))}
                  </Popover>
                  <Button variant="primary" onClick={() => setEditing(true)}>
                    Edit details
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={refresh} disabled={loading} aria-label="Refresh profile">
                <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </>
          }
        />
      </Card>

      {loading ? (
        <LoadingPanel label="Loading student profile…" />
      ) : error || !profile ? (
        <Alert
          tone="error"
          title="Could not load student profile"
          action={
            <Button variant="danger" size="sm" onClick={refresh}>
              Retry
            </Button>
          }
        >
          {error ?? 'Student not found.'}
        </Alert>
      ) : (
        <div className="space-y-6">
          {/* Basic info */}
          <Card>
            <CardHeader title="Student Details" />
            <div className="grid gap-4 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Admission No
                </p>
                <p className="mt-1 font-medium text-gray-900">{profile.admission_no}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Full Name
                </p>
                <p className="mt-1 font-medium text-gray-900">
                  {profile.full_name || 'Unnamed student'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Gender
                </p>
                <p className="mt-1 text-gray-800">{profile.gender || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Pathway
                </p>
                <p className="mt-1 text-gray-800">{profile.pathway || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Current Class
                </p>
                <p className="mt-1 text-gray-800">
                  {latestEnrollment?.class_name ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Current Stream
                </p>
                <p className="mt-1 text-gray-800">
                  {latestEnrollment?.stream_name ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Academic Year
                </p>
                <p className="mt-1 text-gray-800">
                  {latestEnrollment?.academic_year ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Registered
                </p>
                <p className="mt-1 text-gray-800">
                  {new Date(profile.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </Card>

          {/* Records: medical alerts, emergency contacts, placement, notes */}
          <StudentRecordPanels studentId={profile.student_id} />

          {/* Enrollment history */}
          {profile.enrollments.length > 0 && (
            <Card>
              <CardHeader
                title="Enrollment History"
              />
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Academic Year
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Class
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Stream
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {profile.enrollments.map((e, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {e.academic_year ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-800">
                          {e.class_name ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {e.stream_name ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Published exams with marks */}
          {profile.published_exams_with_marks.length > 0 && (
            <Card>
              <CardHeader
                title="Published Exams with Marks"
              />
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Exam
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Term
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Academic Year
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Report Card
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {profile.published_exams_with_marks.map((e) => (
                      <tr key={e.exam_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {e.exam_name}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{e.term ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {e.academic_year ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Link
                            href={`/analytics/report/${encodeURIComponent(
                              profile.student_id
                            )}?exam=${encodeURIComponent(e.exam_id)}`}
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            View Report Card
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Exam history (from get_student_exam_history) */}
          {examHistory.length > 0 && (
            <Card>
              <CardHeader
                title="Exam History"
              />
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Exam
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Term
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Year
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Total
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Mean
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Grade
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Position
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {examHistory.map((h) => (
                      <tr key={h.exam_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {h.exam_name}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{h.term ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {h.academic_year ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-800">{h.total_score}</td>
                        <td className="px-4 py-2.5 text-gray-800">
                          {h.mean_score.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge className="border-blue-200 bg-blue-50 text-blue-800">
                            {h.overall_grade ?? '—'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">
                          {h.position} / {h.total_in_exam}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
      {profile && (
        <EditStudentModal
          open={editing}
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={refresh}
        />
      )}
    </main>
  );
}
