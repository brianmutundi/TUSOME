'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getStudentExamHistory,
  getStudentProfile,
  getTransportRoutes,
  saveStudentResidenceTransport,
  describeAnalyticsError,
  isAbortError,
} from '@/lib/analytics/api';
import { isUuid } from '@/lib/analytics/guards';
import type { StudentProfileData, StudentResidenceType, StudentTransportMode, TransportRoute } from '@/lib/analytics/types';

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
  const [editingResidence, setEditingResidence] = useState(false);
  const [savingResidence, setSavingResidence] = useState(false);
  const [residenceError, setResidenceError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [residenceType, setResidenceType] = useState<StudentResidenceType>('day_scholar');
  const [transportMode, setTransportMode] = useState<StudentTransportMode>('school_transport');
  const [routeId, setRouteId] = useState('');
  const [otherTransportDetails, setOtherTransportDetails] = useState('');

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

  const beginResidenceEdit = async () => {
    if (!profile) return;
    setResidenceType(profile.residence_type ?? 'day_scholar');
    setTransportMode(profile.transport_mode ?? 'school_transport');
    setRouteId(profile.transport_route_id ?? '');
    setOtherTransportDetails(profile.other_transport_details ?? '');
    setResidenceError(null);
    try {
      const availableRoutes = await getTransportRoutes();
      setRoutes(availableRoutes.filter((route) => route.is_active));
      setEditingResidence(true);
    } catch (caught) {
      setResidenceError(describeAnalyticsError(caught, 'Could not load configured transport routes.'));
    }
  };

  const saveResidence = async () => {
    setSavingResidence(true); setResidenceError(null);
    try {
      await saveStudentResidenceTransport(studentId, residenceType, residenceType === 'boarder' ? null : transportMode,
        residenceType === 'day_scholar' && transportMode === 'school_transport' ? routeId : null,
        residenceType === 'day_scholar' && transportMode === 'other' ? otherTransportDetails : null);
      setEditingResidence(false); refresh();
    } catch (caught) {
      setResidenceError(describeAnalyticsError(caught, 'Could not save residence and transport details.'));
    } finally { setSavingResidence(false); }
  };

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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">
              Analytics
            </Link>{' '}
            /{' '}
            <Link href="/analytics/students" className="text-blue-700 hover:underline">
              Student Directory
            </Link>{' '}
            / {profile?.full_name ?? 'Student Profile'}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            {profile?.full_name ?? 'Student Profile'}
          </h1>
          {profile && (
            <p className="mt-1 text-sm text-gray-600">
              {profile.admission_no}
              {profile.gender ? ` · ${profile.gender}` : ''}
              {profile.pathway ? ` · ${profile.pathway}` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {profile && (
            <>
              <Link
                href={`/analytics/report/${encodeURIComponent(profile.student_id)}`}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
              >
                Report Card
              </Link>
              <Link
                href={`/analytics/transcript/${encodeURIComponent(profile.student_id)}`}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Transcript
              </Link>
              <Link
                href={`/analytics/student/${encodeURIComponent(profile.student_id)}`}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Analytics
              </Link>
            </>
          )}
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

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
            <div className="flex items-center justify-between gap-3 px-5 pt-5"><h2 className="text-base font-semibold text-gray-900">Student Details</h2><Button variant="secondary" onClick={beginResidenceEdit}>Edit Residence / Transport</Button></div>
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
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Residence</p>
                <p className="mt-1 text-gray-800">{profile.residence_type === 'boarder' ? 'Boarder' : profile.residence_type === 'day_scholar' ? 'Day Scholar' : 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Transport</p>
                <p className="mt-1 text-gray-800">{profile.residence_type === 'boarder' ? 'Not applicable' : profile.transport_mode ? ({ school_transport: 'School Transport', parent_guardian: 'Parent/Guardian', public_transport: 'Public Transport', walking: 'Walking', other: 'Other' } as const)[profile.transport_mode] : 'Not set'}</p>
                {profile.transport_route_name && <p className="mt-1 text-xs text-gray-500">Route: {profile.transport_route_name}</p>}
                {profile.other_transport_details && <p className="mt-1 text-xs text-gray-500">{profile.other_transport_details}</p>}
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

          {residenceError && <Alert tone="error" title="Residence update failed">{residenceError}</Alert>}
          {editingResidence && <Card><CardHeader title="Edit Residence / Boarding Status" /><div className="space-y-4 p-5">
            <SelectField id="edit-residence-type" label="Residence" value={residenceType} onChange={(e) => { const value = e.target.value as StudentResidenceType; setResidenceType(value); if (value === 'boarder') { setRouteId(''); setOtherTransportDetails(''); } }}>
              <option value="day_scholar">Day Scholar</option><option value="boarder">Boarder</option>
            </SelectField>
            {residenceType === 'day_scholar' && <>
              <SelectField id="edit-transport-mode" label="Means of Transport" value={transportMode} onChange={(e) => { setTransportMode(e.target.value as StudentTransportMode); setRouteId(''); setOtherTransportDetails(''); }}>
                <option value="school_transport">School Transport</option><option value="parent_guardian">Parent / Guardian</option><option value="public_transport">Public Transport</option><option value="walking">Walking</option><option value="other">Other</option>
              </SelectField>
              {transportMode === 'school_transport' && <SelectField id="edit-transport-route" label="Configured Route" required value={routeId} onChange={(e) => setRouteId(e.target.value)}><option value="">Select existing route</option>{routes.map((route) => <option key={route.route_id} value={route.route_id}>{route.name}</option>)}</SelectField>}
              {transportMode === 'other' && <TextField id="edit-other-transport" label="Other Transport Details" required value={otherTransportDetails} onChange={(e) => setOtherTransportDetails(e.target.value)} />}
            </>}
            <div className="flex gap-2"><Button onClick={saveResidence} disabled={savingResidence || (residenceType === 'day_scholar' && transportMode === 'school_transport' && !routeId) || (residenceType === 'day_scholar' && transportMode === 'other' && !otherTransportDetails.trim())}>{savingResidence ? 'Saving…' : 'Save Residence'}</Button><Button variant="secondary" onClick={() => setEditingResidence(false)}>Cancel</Button></div>
          </div></Card>}
          {/* Enrollment history */}
          {profile.enrollments.length > 0 && (
            <Card>
              <CardHeader
                title="Enrollment History"
                description="Class and stream assignments by academic year"
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
                description="Exams where this student has recorded marks"
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
                description="Published exam performance with mean, grade and position"
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
    </main>
  );
}
