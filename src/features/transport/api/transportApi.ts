/** transport API — Supabase RPC calls for the transport feature. */

import { throwIfAborted } from '../../../shared/api/request';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { StudentTransport, TransportRoute, Trip, TripParticipant, Vehicle } from '@/lib/analytics/types';

export async function getVehicles(
  options: RequestOptions = {}
): Promise<Vehicle[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_vehicles')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    vehicle_id: String(raw.vehicle_id ?? ''),
    registration_number: String(raw.registration_number ?? ''),
    vehicle_type: String(raw.vehicle_type ?? 'bus'),
    capacity: Number(raw.capacity ?? 0),
    make: raw.make ? String(raw.make) : null,
    model: raw.model ? String(raw.model) : null,
    year: raw.year != null ? Number(raw.year) : null,
    is_active: Boolean(raw.is_active),
  }));
}

export async function addVehicle(
  registrationNumber: string,
  vehicleType?: string,
  capacity?: number,
  make?: string,
  model?: string,
  year?: number,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_vehicle', {
      p_registration_number: registrationNumber,
      p_vehicle_type: vehicleType ?? 'bus',
      p_capacity: capacity ?? 0,
      p_make: make ?? null,
      p_model: model ?? null,
      p_year: year ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getTransportRoutes(
  options: RequestOptions = {}
): Promise<TransportRoute[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_transport_routes')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    route_id: String(raw.route_id ?? ''),
    name: String(raw.name ?? ''),
    description: raw.description ? String(raw.description) : null,
    vehicle_id: raw.vehicle_id ? String(raw.vehicle_id) : null,
    registration_number: raw.registration_number ? String(raw.registration_number) : null,
    driver_id: raw.driver_id ? String(raw.driver_id) : null,
    driver_name: raw.driver_name ? String(raw.driver_name) : null,
    pickup_points: raw.pickup_points ? String(raw.pickup_points) : null,
    departure_time: raw.departure_time ? String(raw.departure_time) : null,
    return_time: raw.return_time ? String(raw.return_time) : null,
    is_active: Boolean(raw.is_active),
    student_count: Number(raw.student_count ?? 0),
  }));
}

export async function createTransportRoute(
  name: string,
  description?: string,
  vehicleId?: string,
  driverId?: string,
  pickupPoints?: string,
  departureTime?: string,
  returnTime?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_transport_route', {
      p_name: name,
      p_description: description ?? null,
      p_vehicle_id: vehicleId ?? null,
      p_driver_id: driverId ?? null,
      p_pickup_points: pickupPoints ?? null,
      p_departure_time: departureTime ?? null,
      p_return_time: returnTime ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getStudentTransport(
  studentId?: string,
  options: RequestOptions = {}
): Promise<StudentTransport[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_transport', { p_student_id: studentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    assignment_id: String(raw.assignment_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    route_id: String(raw.route_id ?? ''),
    route_name: raw.route_name ? String(raw.route_name) : null,
    pickup_point: raw.pickup_point ? String(raw.pickup_point) : null,
    is_active: Boolean(raw.is_active),
  }));
}

export async function assignStudentTransport(
  studentId: string,
  routeId: string,
  pickupPoint?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('assign_student_transport', {
      p_student_id: studentId,
      p_route_id: routeId,
      p_pickup_point: pickupPoint ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getTrips(
  status?: string,
  options: RequestOptions = {}
): Promise<Trip[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_trips', { p_status: status ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    trip_id: String(raw.trip_id ?? ''),
    title: String(raw.title ?? ''),
    description: raw.description ? String(raw.description) : null,
    trip_type: String(raw.trip_type ?? 'educational'),
    destination: String(raw.destination ?? ''),
    start_date: String(raw.start_date ?? ''),
    end_date: String(raw.end_date ?? ''),
    departure_time: raw.departure_time ? String(raw.departure_time) : null,
    return_time: raw.return_time ? String(raw.return_time) : null,
    transport_mode: raw.transport_mode ? String(raw.transport_mode) : null,
    estimated_cost: raw.estimated_cost != null ? Number(raw.estimated_cost) : null,
    actual_cost: raw.actual_cost != null ? Number(raw.actual_cost) : null,
    status: String(raw.status ?? 'planned'),
    participant_count: Number(raw.participant_count ?? 0),
    permission_slip_count: Number(raw.permission_slip_count ?? 0),
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function createTrip(
  title: string,
  destination: string,
  startDate: string,
  endDate: string,
  tripType?: string,
  description?: string,
  departureTime?: string,
  returnTime?: string,
  transportMode?: string,
  estimatedCost?: number,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_trip', {
      p_title: title,
      p_destination: destination,
      p_start_date: startDate,
      p_end_date: endDate,
      p_trip_type: tripType ?? 'educational',
      p_description: description ?? null,
      p_departure_time: departureTime ?? null,
      p_return_time: returnTime ?? null,
      p_transport_mode: transportMode ?? null,
      p_estimated_cost: estimatedCost ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getTripParticipants(
  tripId: string,
  options: RequestOptions = {}
): Promise<TripParticipant[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_trip_participants', { p_trip_id: tripId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    participant_id: String(raw.participant_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    permission_slip_signed: Boolean(raw.permission_slip_signed),
    permission_slip_date: raw.permission_slip_date ? String(raw.permission_slip_date) : null,
    payment_status: String(raw.payment_status ?? 'pending'),
    amount_paid: Number(raw.amount_paid ?? 0),
    notes: raw.notes ? String(raw.notes) : null,
  }));
}

export async function addTripParticipant(
  tripId: string,
  studentId: string,
  permissionSlipSigned?: boolean,
  permissionSlipDate?: string,
  paymentStatus?: string,
  amountPaid?: number,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_trip_participant', {
      p_trip_id: tripId,
      p_student_id: studentId,
      p_permission_slip_signed: permissionSlipSigned ?? false,
      p_permission_slip_date: permissionSlipDate ?? null,
      p_payment_status: paymentStatus ?? 'pending',
      p_amount_paid: amountPaid ?? 0,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function updateTripStatus(
  tripId: string,
  status: string,
  actualCost?: number,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('update_trip_status', {
      p_trip_id: tripId,
      p_status: status,
      p_actual_cost: actualCost ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}
