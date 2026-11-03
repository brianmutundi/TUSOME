'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, Badge, Button, Card, LoadingPanel } from '@/components/ui';
import { SchoolHeader } from '@/components/documents/SchoolHeader';
import {
  describeAnalyticsError,
  getTripParticipants,
  getTrips,
  isAbortError,
  logAuditEvent,
} from '@/lib/analytics/api';
import type { Trip, TripParticipant } from '@/lib/analytics/types';

function decodeParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return '';
  try { return decodeURIComponent(value); } catch { return value; }
}

export default function PermissionSlipPage() {
  const params = useParams<{ tripId?: string | string[]; studentId?: string | string[] }>();
  const tripId = decodeParam(params?.tripId);
  const studentId = decodeParam(params?.studentId);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [participant, setParticipant] = useState<TripParticipant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!tripId || !studentId) { setLoading(false); setError('Missing parameters.'); return; }
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getTrips(undefined, { signal: controller.signal }),
      getTripParticipants(tripId, { signal: controller.signal }),
    ])
      .then(([trips, participants]) => {
        if (!active) return;
        const foundTrip = trips.find((t) => t.trip_id === tripId);
        const foundParticipant = participants.find((p) => p.student_id === studentId);
        if (foundTrip) setTrip(foundTrip);
        else setError('Trip not found.');
        if (foundParticipant) setParticipant(foundParticipant);
        else setError('Student not found in trip participants.');
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load permission slip.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [tripId, studentId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!tripId || !studentId) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/permission-slip/${studentId}/pdf`);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `permission-slip-${trip?.title || tripId}-${participant?.student_name || studentId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      await logAuditEvent('reprint', 'permission_slip', tripId, undefined, undefined, 'PDF download');
    } catch (caught) {
      setError(describeAnalyticsError(caught, 'Could not download PDF.'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading permission slip…" />;

  if (error || !trip || !participant) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load permission slip">{error || 'Permission slip not found.'}</Alert>
        <div className="mt-4">
          <Link href="/analytics/trips" className="text-blue-700 hover:underline">Back to Trips</Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 16mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #6b7280; }
        }
      `}</style>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="no-print mb-4 flex gap-2">
          <Button variant="primary" onClick={handlePrint}>Print Permission Slip</Button>
          <Button variant="secondary" onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? 'Generating…' : 'Download PDF'}
          </Button>
          <Link href="/analytics/trips" className="text-blue-700 hover:underline text-sm self-center">Back to Trips</Link>
        </div>

        <Card className="receipt-card">
          <div className="p-8">
            <SchoolHeader title="Permission Slip — School Trip / Excursion" />

            <div className="mb-6">
              <h2 className="text-sm font-bold text-gray-900 mb-2">Trip Details</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Trip Title</p>
                  <p className="font-medium text-gray-900">{trip.title}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Destination</p>
                  <p className="font-medium text-gray-900">{trip.destination}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="font-medium text-gray-900">{trip.trip_type}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Dates</p>
                  <p className="font-medium text-gray-900">{trip.start_date} to {trip.end_date}</p>
                </div>
                {trip.departure_time && (
                  <div>
                    <p className="text-xs text-gray-500">Departure Time</p>
                    <p className="font-medium text-gray-900">{trip.departure_time}</p>
                  </div>
                )}
                {trip.transport_mode && (
                  <div>
                    <p className="text-xs text-gray-500">Transport</p>
                    <p className="font-medium text-gray-900">{trip.transport_mode}</p>
                  </div>
                )}
                {trip.estimated_cost != null && (
                  <div>
                    <p className="text-xs text-gray-500">Estimated Cost</p>
                    <p className="font-medium text-gray-900">KES {trip.estimated_cost.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mb-6">
              <h2 className="text-sm font-bold text-gray-900 mb-2">Student Details</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Student Name</p>
                  <p className="font-medium text-gray-900">{participant.student_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Admission Number</p>
                  <p className="font-medium text-gray-900">{participant.admission_no}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Permission Slip</p>
                  <p className="font-medium text-gray-900">{participant.permission_slip_signed ? 'Signed' : 'Not Signed'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payment Status</p>
                  <p className="font-medium text-gray-900">{participant.payment_status}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mb-6">
              <p className="text-sm text-gray-700">
                I, the undersigned parent/guardian, hereby grant permission for my child to participate in the above-mentioned trip/excursion.
                I understand the nature of the activity and accept responsibility for my child&apos;s participation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 mt-8">
              <div>
                <div className="border-t border-gray-400 pt-2">
                  <p className="text-xs text-gray-500">Parent/Guardian Signature</p>
                  <p className="text-xs text-gray-400">Date: _______________</p>
                </div>
              </div>
              <div>
                <div className="border-t border-gray-400 pt-2">
                  <p className="text-xs text-gray-500">Class Teacher Signature</p>
                  <p className="text-xs text-gray-400">Date: _______________</p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center text-xs text-gray-400">
              <p>This is a computer-generated permission slip.</p>
            </div>
          </div>
        </Card>
      </main>
    </>
  );
}
