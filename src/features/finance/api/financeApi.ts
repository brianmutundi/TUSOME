/** finance API — Supabase RPC calls for the finance feature. */

import { throwIfAborted } from '../../../shared/api/request';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { AnalyticsContractError, normalizeFeePayments, normalizeFeePledges, normalizeFeeStructures } from '@/lib/analytics/guards';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { BankStatement, BankStatementLine, Budget, BudgetVsActual, CashBookEntry, ChartOfAccount, FeeBalance, FeeCollection, FeeLedgerEntry, FeePayment, FeePledge, FeeStructure, FeeStructureGroup, FeeWaiver, FiscalPeriod, Invoice, Receipt, ReversalReason, StudentVoteHeadBalance, TrialBalanceRow, VoteHead, VoteHeadCategory, Wallet, WalletTransaction } from '@/lib/analytics/types';

export async function getFeeStructures(
  academicYear?: number,
  term?: string,
  options: RequestOptions = {}
): Promise<FeeStructure[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_structures', { p_academic_year: academicYear ?? null, p_term: term ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeFeeStructures(data);
}

export async function upsertFeeStructure(
  classId: string | null,
  academicYear: number,
  term: string,
  name: string,
  amount: number,
  description?: string,
  isActive?: boolean,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_fee_structure', {
      p_class_id: classId,
      p_academic_year: academicYear,
      p_term: term,
      p_name: name,
      p_amount: amount,
      p_description: description ?? null,
      p_is_active: isActive ?? true,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getFeeBalances(
  search?: string,
  classId?: string,
  term?: string,
  academicYear?: number,
  balanceFilter?: string,
  minBalance?: number,
  maxBalance?: number,
  sortBy?: string,
  sortDir?: string,
  page?: number,
  pageSize?: number,
  options: RequestOptions = {}
): Promise<{ rows: Record<string, unknown>[]; total: number; page: number; page_size: number; summary: Record<string, unknown> }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_balances', {
      p_search: search ?? null,
      p_class_id: classId ?? null,
      p_term: term ?? null,
      p_academic_year: academicYear ?? null,
      p_balance_filter: balanceFilter ?? 'all',
      p_min_balance: minBalance ?? null,
      p_max_balance: maxBalance ?? null,
      p_sort_by: sortBy ?? 'admission_no',
      p_sort_dir: sortDir ?? 'asc',
      p_page: page ?? 1,
      p_page_size: pageSize ?? 25,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (data ?? {}) as { rows: Record<string, unknown>[]; total: number; page: number; page_size: number; summary: Record<string, unknown> };
}

export async function getStudentFeeBalance(
  studentId: string,
  academicYear?: number,
  term?: string,
  options: RequestOptions = {}
): Promise<FeeBalance> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_fee_balance', { p_student_id: studentId, p_academic_year: academicYear ?? null, p_term: term ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  const payload = data as Record<string, unknown>;
  return {
    student_id: String(payload.student_id ?? ''),
    student_name: payload.student_name ? String(payload.student_name) : null,
    admission_no: String(payload.admission_no ?? ''),
    total_fees: Number(payload.total_fees ?? 0),
    total_paid: Number(payload.total_paid ?? 0),
    total_waived: Number(payload.total_waived ?? 0),
    balance: Number(payload.balance ?? 0),
  };
}

export async function recordFeePayment(
  studentId: string,
  amount: number,
  paymentMethod: string,
  referenceNumber?: string,
  academicYear?: number,
  term?: string,
  notes?: string,
  idempotencyKey?: string,
  paymentDate?: string,
  allocations?: { vote_head_id?: string; fee_structure_id?: string; amount: number }[],
  paidBy?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('record_fee_payment', {
      p_student_id: studentId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_reference_number: referenceNumber ?? null,
      p_academic_year: academicYear ?? null,
      p_term: term ?? null,
      p_notes: notes ?? null,
      p_idempotency_key: idempotencyKey ?? null,
      p_payment_date: paymentDate ?? null,
      p_allocations: allocations ? JSON.stringify(allocations) : null,
      p_paid_by: paidBy ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getFeePayments(
  studentId?: string,
  limit?: number,
  offset?: number,
  options: RequestOptions = {}
): Promise<FeePayment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_payments', { p_student_id: studentId ?? null, p_limit: limit ?? 50, p_offset: offset ?? 0 })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeFeePayments(data);
}

export async function getFeeLedgerReport(
  studentId?: string,
  limit = 500,
  options: RequestOptions = {}
): Promise<FeeLedgerEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_ledger_report', {
      p_student_id: studentId ?? null,
      p_limit: limit,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    payment_id: String(raw.payment_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    amount: Number(raw.amount ?? 0),
    payment_method: String(raw.payment_method ?? 'cash'),
    reference_number: raw.reference_number ? String(raw.reference_number) : null,
    academic_year: raw.academic_year ? Number(raw.academic_year) : null,
    term: raw.term ? String(raw.term) : null,
    notes: raw.notes ? String(raw.notes) : null,
    recorded_by_name: raw.recorded_by_name ? String(raw.recorded_by_name) : null,
    paid_by: raw.paid_by ? String(raw.paid_by) : null,
    paid_at: String(raw.paid_at ?? ''),
    entry_type: raw.entry_type === 'reversal' ? 'reversal' : 'payment',
    reversal_reason: raw.reversal_reason ? String(raw.reversal_reason) : null,
    receipt_id: raw.receipt_id ? String(raw.receipt_id) : null,
    receipt_number: raw.receipt_number ? String(raw.receipt_number) : null,
  }));
}

export async function getFeePledges(
  studentId?: string,
  options: RequestOptions = {}
): Promise<FeePledge[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_pledges', { p_student_id: studentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return normalizeFeePledges(data);
}

export async function createFeePledge(
  studentId: string,
  pledgedAmount: number,
  dueDate?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_fee_pledge', {
      p_student_id: studentId,
      p_pledged_amount: pledgedAmount,
      p_due_date: dueDate ?? null,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getInvoices(
  status?: string,
  options: RequestOptions = {}
): Promise<Invoice[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_invoices', { p_status: status ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    invoice_id: String(raw.invoice_id ?? ''),
    invoice_number: String(raw.invoice_number ?? ''),
    student_id: raw.student_id ? String(raw.student_id) : null,
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: raw.admission_no ? String(raw.admission_no) : null,
    amount: Number(raw.amount ?? 0),
    tax_amount: Number(raw.tax_amount ?? 0),
    total_amount: Number(raw.total_amount ?? 0),
    status: String(raw.status ?? 'draft'),
    due_date: raw.due_date ? String(raw.due_date) : null,
    issued_date: String(raw.issued_date ?? ''),
    notes: raw.notes ? String(raw.notes) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function createInvoice(
  invoiceNumber: string,
  studentId?: string,
  amount?: number,
  taxAmount?: number,
  dueDate?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_invoice', {
      p_invoice_number: invoiceNumber,
      p_student_id: studentId ?? null,
      p_amount: amount ?? 0,
      p_tax_amount: taxAmount ?? 0,
      p_due_date: dueDate ?? null,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getReceipts(
  invoiceId?: string,
  options: RequestOptions = {}
): Promise<Receipt[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_receipts', { p_invoice_id: invoiceId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    receipt_id: String(raw.receipt_id ?? ''),
    invoice_id: raw.invoice_id ? String(raw.invoice_id) : null,
    invoice_number: raw.invoice_number ? String(raw.invoice_number) : null,
    receipt_number: String(raw.receipt_number ?? ''),
    amount_paid: Number(raw.amount_paid ?? 0),
    payment_method: String(raw.payment_method ?? 'cash'),
    reference_number: raw.reference_number ? String(raw.reference_number) : null,
    paid_at: String(raw.paid_at ?? ''),
    recorded_by_name: raw.recorded_by_name ? String(raw.recorded_by_name) : null,
    payment_id: raw.payment_id ? String(raw.payment_id) : null,
    paid_by: raw.paid_by ? String(raw.paid_by) : null,
  }));
}

export async function recordReceipt(
  invoiceId: string,
  receiptNumber: string,
  amountPaid: number,
  paymentMethod?: string,
  referenceNumber?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('record_receipt', {
      p_invoice_id: invoiceId,
      p_receipt_number: receiptNumber,
      p_amount_paid: amountPaid,
      p_payment_method: paymentMethod ?? 'cash',
      p_reference_number: referenceNumber ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getWallet(
  ownerId: string,
  options: RequestOptions = {}
): Promise<Wallet> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_wallet', { p_owner_id: ownerId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  const payload = data as Record<string, unknown>;
  return {
    wallet_id: String(payload.wallet_id ?? ''),
    owner_id: String(payload.owner_id ?? ''),
    balance: Number(payload.balance ?? 0),
    currency: String(payload.currency ?? 'KES'),
    owner_type: String(payload.owner_type ?? 'student'),
  };
}

export async function createWalletTransaction(
  ownerId: string,
  transactionType: string,
  amount: number,
  description?: string,
  referenceNumber?: string,
  paymentMethod?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_wallet_transaction', {
      p_owner_id: ownerId,
      p_transaction_type: transactionType,
      p_amount: amount,
      p_description: description ?? null,
      p_reference_number: referenceNumber ?? null,
      p_payment_method: paymentMethod ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getWalletTransactions(
  ownerId: string,
  limit?: number,
  options: RequestOptions = {}
): Promise<WalletTransaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_wallet_transactions', { p_owner_id: ownerId, p_limit: limit ?? 50 })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    transaction_id: String(raw.transaction_id ?? ''),
    transaction_type: String(raw.transaction_type ?? ''),
    amount: Number(raw.amount ?? 0),
    balance_after: Number(raw.balance_after ?? 0),
    description: raw.description ? String(raw.description) : null,
    reference_number: raw.reference_number ? String(raw.reference_number) : null,
    payment_method: raw.payment_method ? String(raw.payment_method) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function getVoteHeads(
  options: RequestOptions = {}
): Promise<VoteHead[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_vote_heads')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    vote_head_id: String(raw.vote_head_id ?? ''),
    name: String(raw.name ?? ''),
    code: raw.code ? String(raw.code) : null,
    category_id: raw.category_id ? String(raw.category_id) : null,
    category_name: raw.category_name ? String(raw.category_name) : null,
    description: raw.description ? String(raw.description) : null,
    is_active: Boolean(raw.is_active),
  }));
}

export async function upsertVoteHead(
  name: string,
  code?: string,
  categoryId?: string,
  description?: string,
  voteHeadId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_vote_head', {
      p_name: name,
      p_code: code ?? null,
      p_category_id: categoryId ?? null,
      p_description: description ?? null,
      p_vote_head_id: voteHeadId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getVoteHeadCategories(
  options: RequestOptions = {}
): Promise<VoteHeadCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_vote_head_categories')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    category_id: String(raw.category_id ?? ''),
    name: String(raw.name ?? ''),
    description: raw.description ? String(raw.description) : null,
  }));
}

export async function getStudentVoteHeadBalances(
  studentId: string,
  options: RequestOptions = {}
): Promise<StudentVoteHeadBalance[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_student_vote_head_balances', { p_student_id: studentId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    vote_head_id: String(raw.vote_head_id ?? ''),
    vote_head_name: String(raw.vote_head_name ?? ''),
    vote_head_code: raw.vote_head_code ? String(raw.vote_head_code) : null,
    category_name: raw.category_name ? String(raw.category_name) : null,
    balance: Number(raw.balance ?? 0),
  }));
}

export async function recordFeeCollection(
  studentId: string,
  amount: number,
  collectionType?: string,
  voteHeadId?: string,
  paymentMethod?: string,
  referenceNumber?: string,
  academicYear?: number,
  term?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('record_fee_collection', {
      p_student_id: studentId,
      p_amount: amount,
      p_collection_type: collectionType ?? 'feeCollection',
      p_vote_head_id: voteHeadId ?? null,
      p_payment_method: paymentMethod ?? 'cash',
      p_reference_number: referenceNumber ?? null,
      p_academic_year: academicYear ?? null,
      p_term: term ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getFinanceOverview(
  academicYear?: number,
  term?: string,
  classId?: string,
  options: RequestOptions = {}
): Promise<Record<string, unknown>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_finance_overview', {
      p_academic_year: academicYear ?? null,
      p_term: term ?? null,
      p_class_id: classId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (data ?? {}) as Record<string, unknown>;
}

export async function getFinanceSummary(
  classId?: string,
  academicYear?: number,
  term?: string,
  startDate?: string,
  endDate?: string,
  options: RequestOptions = {}
): Promise<Record<string, unknown>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_finance_summary', {
      p_class_id: classId ?? null,
      p_academic_year: academicYear ?? null,
      p_term: term ?? null,
      p_start_date: startDate ?? null,
      p_end_date: endDate ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (data ?? {}) as Record<string, unknown>;
}

export async function getFeeCollections(
  studentId?: string,
  classId?: string,
  academicYear?: number,
  term?: string,
  startDate?: string,
  endDate?: string,
  sortBy?: string,
  sortDir?: string,
  limit?: number,
  options: RequestOptions = {}
): Promise<FeeCollection[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_collections', {
      p_student_id: studentId ?? null,
      p_class_id: classId ?? null,
      p_academic_year: academicYear ?? null,
      p_term: term ?? null,
      p_start_date: startDate ?? null,
      p_end_date: endDate ?? null,
      p_limit: limit ?? 50,
      p_sort_by: sortBy ?? 'collected_at',
      p_sort_dir: sortDir ?? 'desc',
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    collection_id: String(raw.collection_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    class_name: raw.class_name ? String(raw.class_name) : null,
    vote_head_name: raw.vote_head_name ? String(raw.vote_head_name) : null,
    amount: Number(raw.amount ?? 0),
    collection_type: String(raw.collection_type ?? 'feeCollection'),
    payment_method: raw.payment_method ? String(raw.payment_method) : null,
    reference_number: raw.reference_number ? String(raw.reference_number) : null,
    academic_year: raw.academic_year ? Number(raw.academic_year) : null,
    term: raw.term ? String(raw.term) : null,
    recorded_by_name: raw.recorded_by_name ? String(raw.recorded_by_name) : null,
    collected_at: String(raw.collected_at ?? ''),
  }));
}

export async function getReversalReasons(
  options: RequestOptions = {}
): Promise<ReversalReason[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_reversal_reasons')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    reason_id: String(raw.reason_id ?? ''),
    reason: String(raw.reason ?? ''),
    is_active: Boolean(raw.is_active),
  }));
}

export async function getFeeStructureGroups(
  options: RequestOptions = {}
): Promise<FeeStructureGroup[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_structure_groups')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    group_id: String(raw.group_id ?? ''),
    name: String(raw.name ?? ''),
    description: raw.description ? String(raw.description) : null,
  }));
}

export async function upsertFeeStructureGroup(
  name: string,
  description?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_fee_structure_group', {
      p_name: name,
      p_description: description ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getChartOfAccounts(
  options: RequestOptions = {}
): Promise<ChartOfAccount[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_chart_of_accounts')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    account_id: String(raw.account_id ?? ''),
    code: String(raw.code ?? ''),
    name: String(raw.name ?? ''),
    account_type: String(raw.account_type ?? ''),
    parent_id: raw.parent_id ? String(raw.parent_id) : null,
    parent_name: raw.parent_name ? String(raw.parent_name) : null,
    is_active: Boolean(raw.is_active),
    description: raw.description ? String(raw.description) : null,
  }));
}

export async function upsertChartOfAccount(
  code: string,
  name: string,
  accountType: string,
  parentId?: string,
  description?: string,
  accountId?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('upsert_chart_of_account', {
      p_code: code,
      p_name: name,
      p_account_type: accountType,
      p_parent_id: parentId ?? null,
      p_description: description ?? null,
      p_account_id: accountId ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function createJournalEntry(
  entryDate: string,
  description: string,
  reference?: string,
  sourceType?: string,
  sourceId?: string,
  lines?: Array<{ account_id: string; debit: number; credit: number; description?: string }>,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_journal_entry', {
      p_entry_date: entryDate,
      p_description: description,
      p_reference: reference ?? null,
      p_source_type: sourceType ?? null,
      p_source_id: sourceId ?? null,
      p_lines: lines ?? [],
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function postJournalEntry(
  entryId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('post_journal_entry', { p_entry_id: entryId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getTrialBalance(
  asOfDate?: string,
  options: RequestOptions = {}
): Promise<TrialBalanceRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_trial_balance', { p_as_of_date: asOfDate ?? new Date().toISOString().split('T')[0] })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    account_id: String(raw.account_id ?? ''),
    account_code: String(raw.account_code ?? ''),
    account_name: String(raw.account_name ?? ''),
    account_type: String(raw.account_type ?? ''),
    total_debit: Number(raw.total_debit ?? 0),
    total_credit: Number(raw.total_credit ?? 0),
    balance: Number(raw.balance ?? 0),
  }));
}

export async function recordCashBookEntry(
  entryType: string,
  amount: number,
  description: string,
  accountId?: string,
  referenceNumber?: string,
  paymentMethod?: string,
  entryDate?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('record_cash_book_entry', {
      p_entry_type: entryType,
      p_amount: amount,
      p_description: description,
      p_account_id: accountId ?? null,
      p_reference_number: referenceNumber ?? null,
      p_payment_method: paymentMethod ?? null,
      p_entry_date: entryDate ?? new Date().toISOString().split('T')[0],
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getCashBookEntries(
  limit?: number,
  options: RequestOptions = {}
): Promise<CashBookEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_cash_book_entries', { p_limit: limit ?? 50 })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    entry_id: String(raw.entry_id ?? ''),
    entry_date: String(raw.entry_date ?? ''),
    entry_type: String(raw.entry_type ?? ''),
    amount: Number(raw.amount ?? 0),
    description: String(raw.description ?? ''),
    account_code: raw.account_code ? String(raw.account_code) : null,
    account_name: raw.account_name ? String(raw.account_name) : null,
    reference_number: raw.reference_number ? String(raw.reference_number) : null,
    payment_method: raw.payment_method ? String(raw.payment_method) : null,
    recorded_by_name: raw.recorded_by_name ? String(raw.recorded_by_name) : null,
    created_at: String(raw.created_at ?? ''),
  }));
}

export async function submitFeeWaiver(
  studentId: string,
  amount: number,
  reason: string,
  invoiceId?: string,
  supportingReference?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('submit_fee_waiver', {
      p_student_id: studentId,
      p_amount: amount,
      p_reason: reason,
      p_invoice_id: invoiceId ?? null,
      p_supporting_reference: supportingReference ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function approveFeeWaiver(
  waiverId: string,
  reviewNotes?: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('approve_fee_waiver', {
      p_waiver_id: waiverId,
      p_review_notes: reviewNotes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function rejectFeeWaiver(
  waiverId: string,
  reviewNotes?: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('reject_fee_waiver', {
      p_waiver_id: waiverId,
      p_review_notes: reviewNotes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function cancelFeeWaiver(
  waiverId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('cancel_fee_waiver', { p_waiver_id: waiverId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getFeeWaivers(
  status?: string,
  studentId?: string,
  options: RequestOptions = {}
): Promise<FeeWaiver[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_waivers', { p_status: status ?? null, p_student_id: studentId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    waiver_id: String(raw.waiver_id ?? ''),
    student_id: String(raw.student_id ?? ''),
    student_name: raw.student_name ? String(raw.student_name) : null,
    admission_no: String(raw.admission_no ?? ''),
    invoice_id: raw.invoice_id ? String(raw.invoice_id) : null,
    amount: Number(raw.amount ?? 0),
    reason: String(raw.reason ?? ''),
    supporting_reference: raw.supporting_reference ? String(raw.supporting_reference) : null,
    status: String(raw.status ?? 'pending'),
    requested_by_name: raw.requested_by_name ? String(raw.requested_by_name) : null,
    requested_at: String(raw.requested_at ?? ''),
    reviewed_by_name: raw.reviewed_by_name ? String(raw.reviewed_by_name) : null,
    reviewed_at: raw.reviewed_at ? String(raw.reviewed_at) : null,
    review_notes: raw.review_notes ? String(raw.review_notes) : null,
    applied_at: raw.applied_at ? String(raw.applied_at) : null,
  }));
}

export async function getFiscalPeriods(
  options: RequestOptions = {}
): Promise<FiscalPeriod[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fiscal_periods')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    period_id: String(raw.period_id ?? ''),
    name: String(raw.name ?? ''),
    start_date: String(raw.start_date ?? ''),
    end_date: String(raw.end_date ?? ''),
    status: String(raw.status ?? 'open'),
    closed_by_name: raw.closed_by_name ? String(raw.closed_by_name) : null,
    closed_at: raw.closed_at ? String(raw.closed_at) : null,
    close_reason: raw.close_reason ? String(raw.close_reason) : null,
    reopened_by_name: raw.reopened_by_name ? String(raw.reopened_by_name) : null,
    reopened_at: raw.reopened_at ? String(raw.reopened_at) : null,
    reopen_reason: raw.reopen_reason ? String(raw.reopen_reason) : null,
  }));
}

export async function createFiscalPeriod(
  name: string,
  startDate: string,
  endDate: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_fiscal_period', {
      p_name: name,
      p_start_date: startDate,
      p_end_date: endDate,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function closeFiscalPeriod(
  periodId: string,
  reason?: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('close_fiscal_period', {
      p_period_id: periodId,
      p_reason: reason ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function reopenFiscalPeriod(
  periodId: string,
  reason: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('reopen_fiscal_period', {
      p_period_id: periodId,
      p_reason: reason,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function isPeriodLocked(
  date: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('is_period_locked', { p_date: date })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getBudgets(
  status?: string,
  options: RequestOptions = {}
): Promise<Budget[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_budgets', { p_status: status ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    budget_id: String(raw.budget_id ?? ''),
    name: String(raw.name ?? ''),
    fiscal_period_id: raw.fiscal_period_id ? String(raw.fiscal_period_id) : null,
    fiscal_period_name: raw.fiscal_period_name ? String(raw.fiscal_period_name) : null,
    status: String(raw.status ?? 'draft'),
    version: Number(raw.version ?? 1),
    created_by_name: raw.created_by_name ? String(raw.created_by_name) : null,
    approved_by_name: raw.approved_by_name ? String(raw.approved_by_name) : null,
    approved_at: raw.approved_at ? String(raw.approved_at) : null,
    created_at: String(raw.created_at ?? ''),
    line_count: Number(raw.line_count ?? 0),
    total_budget: Number(raw.total_budget ?? 0),
  }));
}

export async function createBudget(
  name: string,
  fiscalPeriodId?: string,
  description?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_budget', {
      p_name: name,
      p_fiscal_period_id: fiscalPeriodId ?? null,
      p_description: description ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function addBudgetLine(
  budgetId: string,
  accountId?: string,
  voteHeadId?: string,
  budgetType?: string,
  amount?: number,
  notes?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_budget_line', {
      p_budget_id: budgetId,
      p_account_id: accountId ?? null,
      p_vote_head_id: voteHeadId ?? null,
      p_budget_type: budgetType ?? 'expenditure',
      p_amount: amount ?? 0,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function approveBudget(
  budgetId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('approve_budget', { p_budget_id: budgetId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getBudgetVsActual(
  budgetId: string,
  startDate?: string,
  endDate?: string,
  options: RequestOptions = {}
): Promise<BudgetVsActual[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_budget_vs_actual', {
      p_budget_id: budgetId,
      p_start_date: startDate ?? null,
      p_end_date: endDate ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    line_id: String(raw.line_id ?? ''),
    account_id: raw.account_id ? String(raw.account_id) : null,
    account_code: raw.account_code ? String(raw.account_code) : null,
    account_name: raw.account_name ? String(raw.account_name) : null,
    vote_head_id: raw.vote_head_id ? String(raw.vote_head_id) : null,
    vote_head_name: raw.vote_head_name ? String(raw.vote_head_name) : null,
    budget_type: String(raw.budget_type ?? 'expenditure'),
    budget_amount: Number(raw.budget_amount ?? 0),
    actual_amount: Number(raw.actual_amount ?? 0),
    variance: Number(raw.variance ?? 0),
    variance_pct: raw.variance_pct != null ? Number(raw.variance_pct) : null,
  }));
}

export async function getBankStatements(
  options: RequestOptions = {}
): Promise<BankStatement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_bank_statements')
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    statement_id: String(raw.statement_id ?? ''),
    account_name: String(raw.account_name ?? ''),
    bank_name: raw.bank_name ? String(raw.bank_name) : null,
    statement_date: String(raw.statement_date ?? ''),
    opening_balance: Number(raw.opening_balance ?? 0),
    closing_balance: Number(raw.closing_balance ?? 0),
    file_name: raw.file_name ? String(raw.file_name) : null,
    status: String(raw.status ?? 'imported'),
    imported_by_name: raw.imported_by_name ? String(raw.imported_by_name) : null,
    imported_at: String(raw.imported_at ?? ''),
    line_count: Number(raw.line_count ?? 0),
    matched_count: Number(raw.matched_count ?? 0),
    unmatched_count: Number(raw.unmatched_count ?? 0),
  }));
}

export async function createBankStatement(
  accountName: string,
  statementDate: string,
  bankName?: string,
  openingBalance?: number,
  closingBalance?: number,
  fileName?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_bank_statement', {
      p_account_name: accountName,
      p_statement_date: statementDate,
      p_bank_name: bankName ?? null,
      p_opening_balance: openingBalance ?? 0,
      p_closing_balance: closingBalance ?? 0,
      p_file_name: fileName ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function addBankStatementLine(
  statementId: string,
  transactionDate: string,
  description?: string,
  referenceNumber?: string,
  debit?: number,
  credit?: number,
  direction?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_bank_statement_line', {
      p_statement_id: statementId,
      p_transaction_date: transactionDate,
      p_description: description ?? null,
      p_reference_number: referenceNumber ?? null,
      p_debit: debit ?? 0,
      p_credit: credit ?? 0,
      p_direction: direction ?? 'credit',
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function getBankStatementLines(
  statementId: string,
  matchStatus?: string,
  options: RequestOptions = {}
): Promise<BankStatementLine[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_bank_statement_lines', { p_statement_id: statementId, p_match_status: matchStatus ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    line_id: String(raw.line_id ?? ''),
    transaction_date: String(raw.transaction_date ?? ''),
    description: raw.description ? String(raw.description) : null,
    reference_number: raw.reference_number ? String(raw.reference_number) : null,
    debit: Number(raw.debit ?? 0),
    credit: Number(raw.credit ?? 0),
    amount: Number(raw.amount ?? 0),
    direction: String(raw.direction ?? 'credit'),
    match_status: String(raw.match_status ?? 'unmatched'),
    matched_payment_id: raw.matched_payment_id ? String(raw.matched_payment_id) : null,
    matched_collection_id: raw.matched_collection_id ? String(raw.matched_collection_id) : null,
    is_duplicate: Boolean(raw.is_duplicate),
    match_notes: raw.match_notes ? String(raw.match_notes) : null,
  }));
}

export async function matchBankLine(
  lineId: string,
  paymentId?: string,
  collectionId?: string,
  notes?: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('match_bank_line', {
      p_line_id: lineId,
      p_payment_id: paymentId ?? null,
      p_collection_id: collectionId ?? null,
      p_notes: notes ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function unmatchBankLine(
  lineId: string,
  reason?: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('unmatch_bank_line', { p_line_id: lineId, p_reason: reason ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function completeReconciliation(
  statementId: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('complete_reconciliation', { p_statement_id: statementId })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export interface FeeStatementRow {
  row_kind: string;
  description: string | null;
  term: string | null;
  academic_year: number | null;
  occurred_at: string | null;
  receipt_number: string | null;
  payment_method: string | null;
  paid_by: string | null;
  amount: number;
  running_balance: number;
}

export async function getFeeStatement(
  studentId: string,
  term?: string,
  academicYear?: number,
  options: RequestOptions = {}
): Promise<FeeStatementRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_statement', { p_student_id: studentId, p_term: term ?? null, p_academic_year: academicYear ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []) as FeeStatementRow[];
}

export async function createReceiptShareToken(
  receiptId: string,
  expiresDays?: number,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_document_share_token', { p_document_type: 'receipt', p_document_id: receiptId, p_term: null, p_academic_year: null, p_expires_days: expiresDays ?? 30 })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) throw new AnalyticsContractError('create_document_share_token');
  return data;
}

export interface ReceiptByToken {
  receipt: { id: string; receipt_number: string; amount_paid: number; payment_method: string; reference_number: string | null; paid_at: string };
  payment: { id: string; amount: number; payment_method: string; reference_number: string | null; academic_year: number | null; term: string | null; paid_by: string | null; paid_at: string };
  student: { id: string; full_name: string; admission_no: string; class_name: string | null };
  school: { name: string; logo_url: string | null; motto: string | null; county: string | null; region: string | null; country: string | null; contact_phone: string | null; contact_email: string | null };
  expires_at: string;
}

export async function getReceiptByToken(
  token: string,
  options: RequestOptions = {}
): Promise<ReceiptByToken> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_document_by_token', { p_token: token, p_document_type: 'receipt', p_ip: null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return data as ReceiptByToken;
}

export async function revokeReceiptShareToken(
  token: string,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('revoke_document_share_token', { p_token: token })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function createStatementShareToken(
  studentId: string,
  term?: string,
  academicYear?: number,
  expiresDays?: number,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('create_document_share_token', { p_document_type: 'statement', p_document_id: studentId, p_term: term ?? null, p_academic_year: academicYear ?? null, p_expires_days: expiresDays ?? 7 })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  if (typeof data !== 'string' || data.length === 0) throw new AnalyticsContractError('create_statement_share_token');
  return data;
}

export interface StatementByToken {
  student: { id: string; full_name: string; admission_no: string; class_name: string | null };
  school: { name: string; logo_url: string | null; motto: string | null; county: string | null; region: string | null; country: string | null; contact_phone: string | null; contact_email: string | null };
  term: string | null;
  academic_year: number | null;
  expires_at: string;
}

export async function getStatementByToken(
  token: string,
  options: RequestOptions = {}
): Promise<StatementByToken> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_document_by_token', { p_token: token, p_document_type: 'statement', p_ip: null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return data as StatementByToken;
}

export async function getFeeStatementByToken(
  token: string,
  options: RequestOptions = {}
): Promise<FeeStatementRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_fee_statement_by_token', { p_token: token, p_ip: null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []) as FeeStatementRow[];
}
