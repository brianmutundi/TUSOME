/** payroll API — Supabase RPC calls for the payroll feature. */

import { throwIfAborted } from '../../../shared/api/request';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { EmployeeSalary, PayrollEntry, PayrollPeriod, SalaryComponent } from '@/lib/analytics/types';

export async function getPayrollPeriods(
  options: RequestOptions = {}
): Promise<PayrollPeriod[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_payroll_periods')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    period_id: String(raw.period_id ?? ''),
    name: String(raw.name ?? ''),
    start_date: String(raw.start_date ?? ''),
    end_date: String(raw.end_date ?? ''),
    status: String(raw.status ?? 'draft'),
    created_by_name: raw.created_by_name ? String(raw.created_by_name) : null,
    approved_by_name: raw.approved_by_name ? String(raw.approved_by_name) : null,
    approved_at: raw.approved_at ? String(raw.approved_at) : null,
    finalized_at: raw.finalized_at ? String(raw.finalized_at) : null,
    entry_count: Number(raw.entry_count ?? 0),
  }));
}

export async function createPayrollPeriod(
  name: string,
  startDate: string,
  endDate: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_payroll_period', {
      p_name: name,
      p_start_date: startDate,
      p_end_date: endDate,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getPayrollEntries(
  periodId: string,
  options: RequestOptions = {}
): Promise<PayrollEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_payroll_entries', { p_period_id: periodId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    entry_id: String(raw.entry_id ?? ''),
    staff_id: String(raw.staff_id ?? ''),
    staff_name: raw.staff_name ? String(raw.staff_name) : null,
    basic_salary: Number(raw.basic_salary ?? 0),
    gross_earnings: Number(raw.gross_earnings ?? 0),
    total_deductions: Number(raw.total_deductions ?? 0),
    net_pay: Number(raw.net_pay ?? 0),
    employer_contributions: Number(raw.employer_contributions ?? 0),
    paye: Number(raw.paye ?? 0),
    nssf_employee: Number(raw.nssf_employee ?? 0),
    nssf_employer: Number(raw.nssf_employer ?? 0),
    sha_employee: Number(raw.sha_employee ?? 0),
    ahl_employee: Number(raw.ahl_employee ?? 0),
    ahl_employer: Number(raw.ahl_employer ?? 0),
    status: String(raw.status ?? 'draft'),
  }));
}

export async function generatePayroll(
  periodId: string,
  options: RequestOptions = {}
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('generate_payroll', { p_period_id: periodId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Number(data ?? 0);
}

export async function approvePayroll(
  periodId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('approve_payroll', { p_period_id: periodId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function finalizePayroll(
  periodId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('finalize_payroll', { p_period_id: periodId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getSalaryComponents(
  options: RequestOptions = {}
): Promise<SalaryComponent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_salary_components')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    component_id: String(raw.component_id ?? ''),
    name: String(raw.name ?? ''),
    component_type: String(raw.component_type ?? ''),
    calculation_type: String(raw.calculation_type ?? 'fixed'),
    default_amount: raw.default_amount != null ? Number(raw.default_amount) : null,
    percentage_rate: raw.percentage_rate != null ? Number(raw.percentage_rate) : null,
    is_taxable: Boolean(raw.is_taxable),
    is_pensionable: Boolean(raw.is_pensionable),
    statutory_type: raw.statutory_type ? String(raw.statutory_type) : null,
    effective_from: String(raw.effective_from ?? ''),
    effective_to: raw.effective_to ? String(raw.effective_to) : null,
    is_active: Boolean(raw.is_active),
  }));
}

export async function upsertSalaryComponent(
  name: string,
  componentType: string,
  calculationType?: string,
  defaultAmount?: number,
  percentageRate?: number,
  isTaxable?: boolean,
  isPensionable?: boolean,
  statutoryType?: string,
  effectiveFrom?: string,
  effectiveTo?: string,
  isActive?: boolean,
  componentId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_salary_component', {
      p_name: name,
      p_component_type: componentType,
      p_calculation_type: calculationType ?? 'fixed',
      p_default_amount: defaultAmount ?? null,
      p_percentage_rate: percentageRate ?? null,
      p_is_taxable: isTaxable ?? true,
      p_is_pensionable: isPensionable ?? true,
      p_statutory_type: statutoryType ?? 'none',
      p_effective_from: effectiveFrom ?? new Date().toISOString().split('T')[0],
      p_effective_to: effectiveTo ?? null,
      p_is_active: isActive ?? true,
      p_component_id: componentId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getEmployeeSalaries(
  staffId?: string,
  options: RequestOptions = {}
): Promise<EmployeeSalary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_employee_salaries', { p_staff_id: staffId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    salary_id: String(raw.salary_id ?? ''),
    staff_id: String(raw.staff_id ?? ''),
    staff_name: raw.staff_name ? String(raw.staff_name) : null,
    basic_salary: Number(raw.basic_salary ?? 0),
    effective_from: String(raw.effective_from ?? ''),
    effective_to: raw.effective_to ? String(raw.effective_to) : null,
    is_active: Boolean(raw.is_active),
    component_count: Number(raw.component_count ?? 0),
  }));
}

export async function upsertEmployeeSalary(
  staffId: string,
  basicSalary: number,
  effectiveFrom?: string,
  effectiveTo?: string,
  isActive?: boolean,
  salaryId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_employee_salary', {
      p_staff_id: staffId,
      p_basic_salary: basicSalary,
      p_effective_from: effectiveFrom ?? new Date().toISOString().split('T')[0],
      p_effective_to: effectiveTo ?? null,
      p_is_active: isActive ?? true,
      p_salary_id: salaryId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}
