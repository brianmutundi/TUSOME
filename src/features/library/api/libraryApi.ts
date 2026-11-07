/** library API — Supabase RPC calls for the library feature. */

import { throwIfAborted } from '../../../shared/api/request';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import { createClient } from '@/lib/supabase/client';
import type { RequestOptions } from '../../../shared/api/request';
import type { BookLoan, LibraryBook } from '@/lib/analytics/types';

export async function getLibraryBooks(
  search?: string,
  options: RequestOptions = {}
): Promise<LibraryBook[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_library_books', { p_search: search ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    book_id: String(raw.book_id ?? ''),
    title: String(raw.title ?? ''),
    author: raw.author ? String(raw.author) : null,
    isbn: raw.isbn ? String(raw.isbn) : null,
    category: raw.category ? String(raw.category) : null,
    publisher: raw.publisher ? String(raw.publisher) : null,
    publication_year: raw.publication_year != null ? Number(raw.publication_year) : null,
    total_copies: Number(raw.total_copies ?? 1),
    available_copies: Number(raw.available_copies ?? 0),
    location: raw.location ? String(raw.location) : null,
    is_active: Boolean(raw.is_active),
  }));
}

export async function addLibraryBook(
  title: string,
  author?: string,
  isbn?: string,
  category?: string,
  publisher?: string,
  publicationYear?: number,
  totalCopies?: number,
  location?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('add_library_book', {
      p_title: title,
      p_author: author ?? null,
      p_isbn: isbn ?? null,
      p_category: category ?? null,
      p_publisher: publisher ?? null,
      p_publication_year: publicationYear ?? null,
      p_total_copies: totalCopies ?? 1,
      p_location: location ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function borrowBook(
  bookId: string,
  borrowerId: string,
  borrowerType?: string,
  dueDate?: string,
  options: RequestOptions = {}
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('borrow_book', {
      p_book_id: bookId,
      p_borrower_id: borrowerId,
      p_borrower_type: borrowerType ?? 'student',
      p_due_date: dueDate ?? null,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return String(data);
}

export async function returnBook(
  loanId: string,
  fineAmount?: number,
  options: RequestOptions = {}
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('return_book', {
      p_loan_id: loanId,
      p_fine_amount: fineAmount ?? 0,
    })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return Boolean(data);
}

export async function getBookLoans(
  status?: string,
  borrowerId?: string,
  options: RequestOptions = {}
): Promise<BookLoan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_book_loans', { p_status: status ?? null, p_borrower_id: borrowerId ?? null })
    .abortSignal(options.signal ?? new AbortController().signal);
  if (error) throw AnalyticsAPIError.fromSupabaseError(error);
  throwIfAborted(options.signal);
  return (Array.isArray(data) ? data : []).map((raw: Record<string, unknown>) => ({
    loan_id: String(raw.loan_id ?? ''),
    book_id: String(raw.book_id ?? ''),
    book_title: raw.book_title ? String(raw.book_title) : null,
    borrower_id: String(raw.borrower_id ?? ''),
    borrower_name: raw.borrower_name ? String(raw.borrower_name) : null,
    borrower_type: String(raw.borrower_type ?? 'student'),
    loan_date: String(raw.loan_date ?? ''),
    due_date: String(raw.due_date ?? ''),
    return_date: raw.return_date ? String(raw.return_date) : null,
    status: String(raw.status ?? 'borrowed'),
    fine_amount: Number(raw.fine_amount ?? 0),
    fine_paid: Boolean(raw.fine_paid),
    is_overdue: Boolean(raw.is_overdue),
  }));
}
