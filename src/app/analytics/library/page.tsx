'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, TextField } from '@/components/ui';
import {
  addLibraryBook,
  describeAnalyticsError,
  getBookLoans,
  getLibraryBooks,
  isAbortError,
} from '@/lib/analytics/api';
import type { BookLoan, LibraryBook } from '@/lib/analytics/types';

export default function LibraryPage() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loans, setLoans] = useState<BookLoan[]>([]);
  const [tab, setTab] = useState<'books' | 'loans'>('books');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formCopies, setFormCopies] = useState('1');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      getLibraryBooks(undefined, { signal: controller.signal }),
      getBookLoans(undefined, undefined, { signal: controller.signal }),
    ])
      .then(([b, l]) => {
        if (!active) return;
        setBooks(b);
        setLoans(l);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load library data.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) { setActionError('Title is required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await addLibraryBook(formTitle.trim(), formAuthor.trim() || undefined, undefined, undefined, undefined, undefined, Number(formCopies) || 1);
      setActionSuccess('Book added.');
      setShowForm(false);
      setFormTitle(''); setFormAuthor(''); setFormCopies('1');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not add book.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading library…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load library">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Library
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Library Management</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage library catalogue, borrowing, and returns.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Book'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {(['books', 'loans'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition ${
              tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Add Book" />
          <form onSubmit={handleAddBook} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField id="lib-title" label="Title" required value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              <TextField id="lib-author" label="Author" value={formAuthor} onChange={(e) => setFormAuthor(e.target.value)} />
              <TextField id="lib-copies" label="Copies" type="number" value={formCopies} onChange={(e) => setFormCopies(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Book'}</Button>
            </div>
          </form>
        </Card>
      )}

      {tab === 'books' && (
        books.length === 0 ? (
          <EmptyState title="No books" description="Add your first book above." />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Title</th>
                    <th scope="col" className="px-4 py-3">Author</th>
                    <th scope="col" className="px-4 py-3">Category</th>
                    <th scope="col" className="px-4 py-3">Total</th>
                    <th scope="col" className="px-4 py-3">Available</th>
                    <th scope="col" className="px-4 py-3">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {books.map((b) => (
                    <tr key={b.book_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{b.title}</td>
                      <td className="px-4 py-2.5 text-gray-700">{b.author || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{b.category || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{b.total_copies}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={b.available_copies > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}>{b.available_copies}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{b.location || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {tab === 'loans' && (
        loans.length === 0 ? (
          <EmptyState title="No loans" description="No book loans recorded." />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Book</th>
                    <th scope="col" className="px-4 py-3">Borrower</th>
                    <th scope="col" className="px-4 py-3">Type</th>
                    <th scope="col" className="px-4 py-3">Loan Date</th>
                    <th scope="col" className="px-4 py-3">Due Date</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Fine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {loans.map((l) => (
                    <tr key={l.loan_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{l.book_title || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{l.borrower_name || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{l.borrower_type}</td>
                      <td className="px-4 py-2.5 text-gray-600">{l.loan_date}</td>
                      <td className="px-4 py-2.5 text-gray-600">{l.due_date}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={l.status === 'returned' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : l.is_overdue ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800'}>{l.status}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{l.fine_amount > 0 ? l.fine_amount : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}
    </main>
  );
}
