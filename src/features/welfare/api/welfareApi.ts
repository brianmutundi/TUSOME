/** welfare API — Supabase RPC calls for the welfare feature. */

import { throwIfAborted } from '../../../shared/api/request';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { normalizeBehaviour } from '@/lib/analytics/guards';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { BehaviourRow, CounsellingReferral, CounsellingSession, EmergencyContact, EventRow, MedicalAlert, MedicalInventoryItem, MedicalVisit, Opportunity, OpportunityApplication, Sport, SportsEvent, SportsParticipation } from '@/lib/analytics/types';

export async function getBehaviourForStudent(
  studentId: string,
  options: RequestOptions = {}
): Promise<BehaviourRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_behaviour_for_student', { p_student_id: studentId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeBehaviour(data);
}

export async function getEvents(
  startDate?: string,
  endDate?: string,
  options: RequestOptions = {}
): Promise<EventRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_events', { p_start_date: startDate ?? null, p_end_date: endDate ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    event_id: String(raw.event_id ?? ''),
    title: String(raw.title ?? ''),
    description: raw.description ? String(raw.description) : null,
    event_type: String(raw.event_type ?? 'general'),
    start_date: String(raw.start_date ?? ''),
    end_date: raw.end_date ? String(raw.end_date) : null,
    location: raw.location ? String(raw.location) : null,
    is_all_day: Boolean(raw.is_all_day),
    created_by_name: raw.created_by_name ? String(raw.created_by_name) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function createEvent(
  title: string,
  description?: string,
  eventType?: string,
  startDate?: string,
  endDate?: string,
  location?: string,
  isAllDay?: boolean,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_event', {
      p_title: title,
      p_description: description ?? null,
      p_event_type: eventType ?? 'general',
      p_start_date: startDate ?? new Date().toISOString(),
      p_end_date: endDate ?? null,
      p_location: location ?? null,
      p_is_all_day: isAllDay ?? false,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getCounsellingSessions(
  studentId?: string,
  options: RequestOptions = {}
): Promise<CounsellingSession[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_counselling_sessions', { p_student_id: studentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    session_id: String(raw.session_id ?? ''),
    student_id: raw.student_id ? String(raw.student_id) : null,
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: raw.admission_no ? String(raw.admission_no) : null,
    counsellor_name: raw.counsellor_name ? String(raw.counsellor_name) : null,
    session_date: String(raw.session_date ?? ''),
    session_type: String(raw.session_type ?? 'individual'),
    topic: raw.topic ? String(raw.topic) : null,
    notes: raw.notes ? String(raw.notes) : null,
    outcome: raw.outcome ? String(raw.outcome) : null,
    follow_up_date: raw.follow_up_date ? String(raw.follow_up_date) : null,
    status: String(raw.status ?? 'scheduled'),
  }));
}

export async function createCounsellingSession(
  studentId?: string,
  sessionType?: string,
  topic?: string,
  notes?: string,
  sessionDate?: string,
  outcome?: string,
  followUpDate?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_counselling_session', {
      p_student_id: studentId ?? null,
      p_session_type: sessionType ?? 'individual',
      p_topic: topic ?? null,
      p_notes: notes ?? null,
      p_session_date: sessionDate ?? new Date().toISOString(),
      p_outcome: outcome ?? null,
      p_follow_up_date: followUpDate ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getCounsellingReferrals(
  studentId?: string,
  options: RequestOptions = {}
): Promise<CounsellingReferral[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_counselling_referrals', { p_student_id: studentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    referral_id: String(raw.referral_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    referred_by_name: raw.referred_by_name ? String(raw.referred_by_name) : null,
    reason: String(raw.reason ?? ''),
    urgency: String(raw.urgency ?? 'normal'),
    status: String(raw.status ?? 'pending'),
    notes: raw.notes ? String(raw.notes) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function createCounsellingReferral(
  studentId: string,
  reason: string,
  urgency?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_counselling_referral', {
      p_student_id: studentId,
      p_reason: reason,
      p_urgency: urgency ?? 'normal',
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getMedicalVisits(
  studentId?: string,
  options: RequestOptions = {}
): Promise<MedicalVisit[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_medical_visits', { p_student_id: studentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    visit_id: String(raw.visit_id ?? ''),
    student_id: raw.student_id ? String(raw.student_id) : null,
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: raw.admission_no ? String(raw.admission_no) : null,
    visit_date: String(raw.visit_date ?? ''),
    complaint: raw.complaint ? String(raw.complaint) : null,
    diagnosis: raw.diagnosis ? String(raw.diagnosis) : null,
    treatment: raw.treatment ? String(raw.treatment) : null,
    referred_to: raw.referred_to ? String(raw.referred_to) : null,
    attended_by_name: raw.attended_by_name ? String(raw.attended_by_name) : null,
    status: String(raw.status ?? 'completed'),
    notes: raw.notes ? String(raw.notes) : null,
  }));
}

export async function createMedicalVisit(
  studentId?: string,
  complaint?: string,
  diagnosis?: string,
  treatment?: string,
  referredTo?: string,
  status?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_medical_visit', {
      p_student_id: studentId ?? null,
      p_complaint: complaint ?? null,
      p_diagnosis: diagnosis ?? null,
      p_treatment: treatment ?? null,
      p_referred_to: referredTo ?? null,
      p_status: status ?? 'completed',
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getMedicalInventory(
  options: RequestOptions = {}
): Promise<MedicalInventoryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_medical_inventory')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    item_id: String(raw.item_id ?? ''),
    item_name: String(raw.item_name ?? ''),
    category: raw.category ? String(raw.category) : null,
    quantity: Number(raw.quantity ?? 0),
    unit: raw.unit ? String(raw.unit) : null,
    expiry_date: raw.expiry_date ? String(raw.expiry_date) : null,
    supplier: raw.supplier ? String(raw.supplier) : null,
  }));
}

export async function getOpportunities(
  activeOnly?: boolean,
  options: RequestOptions = {}
): Promise<Opportunity[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_opportunities', { p_active_only: activeOnly ?? true })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    opportunity_id: String(raw.opportunity_id ?? ''),
    title: String(raw.title ?? ''),
    description: raw.description ? String(raw.description) : null,
    opportunity_type: String(raw.opportunity_type ?? 'scholarship'),
    eligibility_criteria: raw.eligibility_criteria ? String(raw.eligibility_criteria) : null,
    deadline: raw.deadline ? String(raw.deadline) : null,
    application_url: raw.application_url ? String(raw.application_url) : null,
    is_active: Boolean(raw.is_active),
    applicant_count: Number(raw.applicant_count ?? 0),
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function createOpportunity(
  title: string,
  description?: string,
  opportunityType?: string,
  eligibilityCriteria?: string,
  deadline?: string,
  applicationUrl?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_opportunity', {
      p_title: title,
      p_description: description ?? null,
      p_opportunity_type: opportunityType ?? 'scholarship',
      p_eligibility_criteria: eligibilityCriteria ?? null,
      p_deadline: deadline ?? null,
      p_application_url: applicationUrl ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function applyForOpportunity(
  opportunityId: string,
  studentId: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('apply_for_opportunity', {
      p_opportunity_id: opportunityId,
      p_student_id: studentId,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getOpportunityApplications(
  opportunityId?: string,
  options: RequestOptions = {}
): Promise<OpportunityApplication[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_opportunity_applications', { p_opportunity_id: opportunityId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    application_id: String(raw.application_id ?? ''),
    opportunity_id: String(raw.opportunity_id ?? ''),
    opportunity_title: raw.opportunity_title ? String(raw.opportunity_title) : null,
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    status: String(raw.status ?? 'applied'),
    notes: raw.notes ? String(raw.notes) : null,
    applied_at: String(raw.applied_at ?? ''),
  }));
}

export async function getEmergencyContacts(
  studentId: string,
  options: RequestOptions = {}
): Promise<EmergencyContact[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_emergency_contacts', { p_student_id: studentId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    contact_id: String(raw.contact_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    full_name: String(raw.full_name ?? ''),
    relationship: String(raw.relationship ?? ''),
    phone_primary: String(raw.phone_primary ?? ''),
    phone_secondary: raw.phone_secondary ? String(raw.phone_secondary) : null,
    email: raw.email ? String(raw.email) : null,
    is_primary: Boolean(raw.is_primary),
    is_authorized_pickup: Boolean(raw.is_authorized_pickup),
    notes: raw.notes ? String(raw.notes) : null,
  }));
}

export async function upsertEmergencyContact(
  studentId: string,
  fullName: string,
  relationship: string,
  phonePrimary: string,
  phoneSecondary?: string,
  email?: string,
  isPrimary?: boolean,
  isAuthorizedPickup?: boolean,
  notes?: string,
  contactId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_emergency_contact', {
      p_student_id: studentId,
      p_full_name: fullName,
      p_relationship: relationship,
      p_phone_primary: phonePrimary,
      p_phone_secondary: phoneSecondary ?? null,
      p_email: email ?? null,
      p_is_primary: isPrimary ?? false,
      p_is_authorized_pickup: isAuthorizedPickup ?? false,
      p_notes: notes ?? null,
      p_contact_id: contactId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getMedicalAlerts(
  studentId: string,
  options: RequestOptions = {}
): Promise<MedicalAlert[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_medical_alerts', { p_student_id: studentId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    alert_id: String(raw.alert_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    alert_type: String(raw.alert_type ?? ''),
    description: String(raw.description ?? ''),
    severity: String(raw.severity ?? 'medium'),
    instructions: raw.instructions ? String(raw.instructions) : null,
    is_active: Boolean(raw.is_active),
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function upsertMedicalAlert(
  studentId: string,
  alertType: string,
  description: string,
  severity?: string,
  instructions?: string,
  isActive?: boolean,
  alertId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_medical_alert', {
      p_student_id: studentId,
      p_alert_type: alertType,
      p_description: description,
      p_severity: severity ?? 'medium',
      p_instructions: instructions ?? null,
      p_is_active: isActive ?? true,
      p_alert_id: alertId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getSports(
  options: RequestOptions = {}
): Promise<Sport[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_sports')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    sport_id: String(raw.sport_id ?? ''),
    name: String(raw.name ?? ''),
    description: raw.description ? String(raw.description) : null,
    sport_type: String(raw.sport_type ?? 'sport'),
    is_active: Boolean(raw.is_active),
    event_count: Number(raw.event_count ?? 0),
  }));
}

export async function createSport(
  name: string,
  description?: string,
  sportType?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_sport', {
      p_name: name,
      p_description: description ?? null,
      p_sport_type: sportType ?? 'sport',
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getSportsEvents(
  sportId?: string,
  options: RequestOptions = {}
): Promise<SportsEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_sports_events', { p_sport_id: sportId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    event_id: String(raw.event_id ?? ''),
    sport_id: raw.sport_id ? String(raw.sport_id) : null,
    sport_name: raw.sport_name ? String(raw.sport_name) : null,
    title: String(raw.title ?? ''),
    event_date: String(raw.event_date ?? ''),
    event_type: String(raw.event_type ?? 'match'),
    venue: raw.venue ? String(raw.venue) : null,
    opponent: raw.opponent ? String(raw.opponent) : null,
    result: raw.result ? String(raw.result) : null,
    score: raw.score ? String(raw.score) : null,
    participant_count: Number(raw.participant_count ?? 0),
  }));
}

export async function createSportsEvent(
  title: string,
  eventDate: string,
  sportId?: string,
  eventType?: string,
  venue?: string,
  opponent?: string,
  result?: string,
  score?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_sports_event', {
      p_title: title,
      p_event_date: eventDate,
      p_sport_id: sportId ?? null,
      p_event_type: eventType ?? 'match',
      p_venue: venue ?? null,
      p_opponent: opponent ?? null,
      p_result: result ?? null,
      p_score: score ?? null,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getSportsParticipation(
  eventId: string,
  options: RequestOptions = {}
): Promise<SportsParticipation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_sports_participation', { p_event_id: eventId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    participation_id: String(raw.participation_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    role: String(raw.role ?? 'player'),
    performance_notes: raw.performance_notes ? String(raw.performance_notes) : null,
  }));
}

export async function addSportsParticipation(
  eventId: string,
  studentId: string,
  role?: string,
  performanceNotes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_sports_participation', {
      p_event_id: eventId,
      p_student_id: studentId,
      p_role: role ?? 'player',
      p_performance_notes: performanceNotes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}
