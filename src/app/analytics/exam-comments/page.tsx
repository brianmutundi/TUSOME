'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  addExamComment,
  describeAnalyticsError,
  getAnalyticsFilters,
  getExamComments,
  isAbortError,
} from '@/lib/analytics/api';
import type { AnalyticsFilterOptions } from '@/lib/analytics/api';
import type { ExamComment, ExamOption } from '@/lib/analytics/types';

export default function ExamCommentsPage() {
  const [options, setOptions] = useState<AnalyticsFilterOptions>({ exams: [], classes: [], streams: [] });
  const [examId, setExamId] = useState('');
  const [comments, setComments] = useState<ExamComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentType, setCommentType] = useState('general');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getAnalyticsFilters({ signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setOptions(data);
        if (data.exams.length > 0) setExamId(data.exams[0].id);
      })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load filters.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  const loadComments = useCallback(() => {
    if (!examId) { setComments([]); return; }
    const controller = new AbortController();
    let active = true;
    setLoadingComments(true);
    getExamComments(examId, undefined, { signal: controller.signal })
      .then((data) => { if (!active) return; setComments(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setActionError(describeAnalyticsError(caught, 'Could not load comments.')); })
      .finally(() => { if (active) setLoadingComments(false); });
    return () => { active = false; controller.abort(); };
  }, [examId]);

  useEffect(() => { const cleanup = loadComments(); return cleanup; }, [loadComments]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) { setActionError('Comment text is required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await addExamComment(examId, undefined, commentText.trim(), commentType);
      setActionSuccess('Comment added.');
      setShowForm(false);
      setCommentText('');
      loadComments();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not add comment.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading exam comments…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load exam comments">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Exam Comments
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Exam Comment System</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage exam comments and report card remarks.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Comment'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      <Card className="mb-6">
        <div className="p-5">
          <SelectField id="ec-exam" label="Exam" value={examId} onChange={(e) => setExamId(e.target.value)}>
            {options.exams.map((e: ExamOption) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </SelectField>
        </div>
      </Card>

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Add Comment" />
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                <select value={commentType} onChange={(e) => setCommentType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="general">General</option>
                  <option value="principal">Principal</option>
                  <option value="teacher">Teacher</option>
                  <option value="stream">Stream</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Comment</label>
              <textarea rows={4} required value={commentText} onChange={(e) => setCommentText(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Comment'}</Button>
            </div>
          </form>
        </Card>
      )}

      {loadingComments ? (
        <LoadingPanel label="Loading comments…" />
      ) : comments.length === 0 ? (
        <EmptyState title="No comments" description="Add your first comment above." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Comment</th>
                  <th scope="col" className="px-4 py-3">Student</th>
                  <th scope="col" className="px-4 py-3">Created By</th>
                  <th scope="col" className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {comments.map((c) => (
                  <tr key={c.comment_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{c.comment_type}</Badge></td>
                    <td className="px-4 py-2.5 text-gray-800">{c.comment_text}</td>
                    <td className="px-4 py-2.5 text-gray-700">{c.student_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{c.created_by_name || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </main>
  );
}
