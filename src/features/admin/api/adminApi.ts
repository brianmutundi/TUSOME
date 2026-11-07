/** admin API — Supabase RPC calls for the admin feature. */

import { throwIfAborted } from '../../../shared/api/request';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { AnalyticsContractError, normalizeAccountDirectory, normalizePermissionCatalogue, normalizeRolesWithPermissions, normalizeSchoolProfile, normalizeSchoolValidity, normalizeSectionHeads, normalizeUserPermissionProfile } from '@/lib/analytics/guards';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { AccountDirectoryRow, AuditEvent, DataRetentionPolicy, PermissionCatalogueItem, RoleWithPermissionsRow, SchoolProfile, SchoolValidity, SectionHeadRow, StaffType, UserPermissionProfile } from '@/lib/analytics/types';

export async function getAccountDirectory(
  options: RequestOptions = {}
): Promise<AccountDirectoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_account_directory')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeAccountDirectory(data);
}

export async function getPermissionCatalogue(
  options: RequestOptions = {}
): Promise<PermissionCatalogueItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_permission_catalogue')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizePermissionCatalogue(data);
}

export async function getRolesWithPermissions(
  options: RequestOptions = {}
): Promise<RoleWithPermissionsRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_roles_with_permissions')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeRolesWithPermissions(data);
}

export interface UpsertCustomRoleInput {
  roleKey?: string;
  displayName: string;
  description?: string;
  staffType: StaffType;
  permissionCodes: string[];
}

export async function upsertCustomRole(
  input: UpsertCustomRoleInput,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_custom_role', {
      p_role_key: input.roleKey ?? input.displayName,
      p_display_name: input.displayName,
      p_description: input.description ?? '',
      p_staff_type: input.staffType,
      p_permission_codes: input.permissionCodes,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) {
    throw new AnalyticsContractError('upsert_custom_role');
  }
  return data;
}

export async function deleteCustomRole(
  roleKey: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('delete_custom_role', { p_role_key: roleKey })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getUserPermissionProfile(
  userId: string,
  options: RequestOptions = {}
): Promise<UserPermissionProfile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_user_permission_profile', { p_user_id: userId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeUserPermissionProfile(data);
}

export interface MyPermissions {
  userId: string;
  role: string | null;
  isAdmin: boolean;
  permissions: string[];
}

export async function getMyPermissions(
  options: RequestOptions = {}
): Promise<MyPermissions> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_my_permissions')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    userId: String(row.user_id ?? ''),
    role: typeof row.role === 'string' ? row.role : null,
    isAdmin: row.is_admin === true,
    permissions: Array.isArray(row.permissions) ? row.permissions.map(String) : [],
  };
}

export async function getSchoolPaybill(options: RequestOptions = {}): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_school_paybill')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return typeof data === 'string' ? data : '';
}

export async function setSchoolPaybill(paybill: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('set_school_paybill', { p_paybill: paybill });
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  return typeof data === 'string' ? data : '';
}

export interface SaveUserPermissionOverridesInput {
  userId: string;
  grantCodes?: string[];
  denyCodes?: string[];
  clearCodes?: string[];
}

export async function saveUserPermissionOverrides(
  input: SaveUserPermissionOverridesInput,
  options: RequestOptions = {}
): Promise<UserPermissionProfile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('save_user_permission_overrides', {
      p_user_id: input.userId,
      p_grant_codes: input.grantCodes ?? [],
      p_deny_codes: input.denyCodes ?? [],
      p_clear_codes: input.clearCodes ?? [],
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeUserPermissionProfile(data);
}

export async function setUserAccessRevoked(
  userId: string,
  revoked: boolean,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('set_user_access_revoked', {
      p_user_id: userId,
      p_revoked: revoked,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export interface InviteOrCreateAccountInput {
  fullName: string;
  email: string;
  role: string;
  staffType: StaffType;
}

export async function inviteOrCreateAccount(
  input: InviteOrCreateAccountInput,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('invite_or_create_account', {
      p_full_name: input.fullName,
      p_email: input.email,
      p_role: input.role,
      p_staff_type: input.staffType,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) {
    throw new AnalyticsContractError('invite_or_create_account');
  }
  return data;
}

export interface UpdateAccountProfileInput {
  userId: string;
  fullName: string;
  email?: string | null;
  role: string;
  staffType: StaffType;
  isActive: boolean;
}

export async function updateAccountProfile(
  input: UpdateAccountProfileInput,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('update_account_profile', {
      p_user_id: input.userId,
      p_full_name: input.fullName,
      p_email: input.email ?? '',
      p_role: input.role,
      p_staff_type: input.staffType,
      p_is_active: input.isActive,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getSectionHeads(
  options: RequestOptions = {}
): Promise<SectionHeadRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_section_heads')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeSectionHeads(data);
}

export async function upsertSectionHead(
  formLevel: string,
  userId: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_section_head', {
      p_form_level: formLevel,
      p_user_id: userId,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) {
    throw new AnalyticsContractError('upsert_section_head');
  }
  return data;
}

export async function deleteSectionHead(
  sectionHeadId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('delete_section_head', {
      p_section_head_id: sectionHeadId,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getSchoolProfile(
  options: RequestOptions = {}
): Promise<SchoolProfile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_school_profile')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeSchoolProfile(data);
}

export async function updateSchoolProfile(
  input: {
    name?: string;
    schoolType?: string;
    country?: string;
    region?: string;
    county?: string;
    educationSystem?: string;
    ownershipType?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    watermarkUrl?: string;
    logoUrl?: string;
    motto?: string;
  },
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('update_school_profile', {
      p_name: input.name ?? null,
      p_school_type: input.schoolType ?? null,
      p_country: input.country ?? null,
      p_region: input.region ?? null,
      p_county: input.county ?? null,
      p_education_system: input.educationSystem ?? null,
      p_ownership_type: input.ownershipType ?? null,
      p_contact_person: input.contactPerson ?? null,
      p_contact_phone: input.contactPhone ?? null,
      p_contact_email: input.contactEmail ?? null,
      p_watermark_url: input.watermarkUrl ?? null,
      p_logo_url: input.logoUrl ?? null,
      p_motto: input.motto ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getSchoolValidity(
  options: RequestOptions = {}
): Promise<SchoolValidity> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_school_validity')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeSchoolValidity(data);
}

export async function logAuditEvent(
  action: string,
  entityType: string,
  entityId?: string,
  beforeValues?: Record<string, unknown>,
  afterValues?: Record<string, unknown>,
  reason?: string,
  correlationId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('log_audit_event', {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId ?? null,
      p_before_values: beforeValues ?? null,
      p_after_values: afterValues ?? null,
      p_reason: reason ?? null,
      p_correlation_id: correlationId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getAuditEvents(
  entityType?: string,
  entityId?: string,
  action?: string,
  limit?: number,
  options: RequestOptions = {}
): Promise<AuditEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_audit_events', {
      p_entity_type: entityType ?? null,
      p_entity_id: entityId ?? null,
      p_action: action ?? null,
      p_limit: limit ?? 100,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    event_id: String(raw.event_id ?? ''),
    actor_id: raw.actor_id ? String(raw.actor_id) : null,
    actor_name: raw.actor_name ? String(raw.actor_name) : null,
    action: String(raw.action ?? ''),
    entity_type: String(raw.entity_type ?? ''),
    entity_id: raw.entity_id ? String(raw.entity_id) : null,
    before_values: raw.before_values ? (raw.before_values as Record<string, unknown>) : null,
    after_values: raw.after_values ? (raw.after_values as Record<string, unknown>) : null,
    reason: raw.reason ? String(raw.reason) : null,
    correlation_id: raw.correlation_id ? String(raw.correlation_id) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function getDataRetentionPolicies(
  options: RequestOptions = {}
): Promise<DataRetentionPolicy[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_data_retention_policies')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    policy_id: String(raw.policy_id ?? ''),
    entity_type: String(raw.entity_type ?? ''),
    retention_days: Number(raw.retention_days ?? 365),
    action: String(raw.action ?? 'archive'),
    is_active: Boolean(raw.is_active),
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function upsertDataRetentionPolicy(
  entityType: string,
  retentionDays: number,
  action?: string,
  isActive?: boolean,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_data_retention_policy', {
      p_entity_type: entityType,
      p_retention_days: retentionDays,
      p_action: action ?? 'archive',
      p_is_active: isActive ?? true,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}
