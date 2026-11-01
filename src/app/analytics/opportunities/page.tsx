'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, TextField } from '@/components/ui';
import {
  createOpportunity,
  describeAnalyticsError,
  getOpportunities,
  isAbortError,
} from '@/lib/analytics/api';
import type { Opportunity } from '@/lib/analytics/types';

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('scholarship');
  const [formCriteria, setFormCriteria] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    getOpportunities(true, { signal: controller.signal })
      .then((data) => { if (!active) return; setOpportunities(data); })
      .catch((caught) => { if (!active || isAbortError(caught)) return; setError(describeAnalyticsError(caught, 'Could not load opportunities.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) { setActionError('Title is required.'); return; }
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await createOpportunity(formTitle.trim(), formDesc.trim() || undefined, formType, formCriteria.trim() || undefined, formDeadline || undefined, formUrl.trim() || undefined);
      setActionSuccess('Opportunity created.');
      setShowForm(false);
      setFormTitle(''); setFormDesc(''); setFormCriteria(''); setFormDeadline(''); setFormUrl('');
      load();
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not create opportunity.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading opportunities…" />;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load opportunities">{error}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">Analytics</Link> / Opportunities
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Opportunities</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Manage scholarships, bursaries, and student opportunities.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Opportunity'}
        </Button>
      </div>

      {actionError && <div className="mb-4"><Alert tone="error" title="Action failed">{actionError}</Alert></div>}
      {actionSuccess && <div className="mb-4"><Alert tone="success" title="Done">{actionSuccess}</Alert></div>}

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Add Opportunity" />
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="opp-title" label="Title" required value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <option value="scholarship">Scholarship</option>
                  <option value="bursary">Bursary</option>
                  <option value="pathway">Pathway</option>
                  <option value="exchange">Exchange</option>
                  <option value="competition">Competition</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <TextField id="opp-criteria" label="Eligibility Criteria" value={formCriteria} onChange={(e) => setFormCriteria(e.target.value)} />
              <TextField id="opp-deadline" label="Deadline" type="date" value={formDeadline} onChange={(e) => setFormDeadline(e.target.value)} />
              <TextField id="opp-url" label="Application URL" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} />
              <TextField id="opp-desc" label="Description" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Opportunity'}</Button>
            </div>
          </form>
        </Card>
      )}

      {opportunities.length === 0 ? (
        <EmptyState title="No opportunities" description="Create your first opportunity above." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Title</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Deadline</th>
                  <th scope="col" className="px-4 py-3">Applicants</th>
                  <th scope="col" className="px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {opportunities.map((o) => (
                  <tr key={o.opportunity_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{o.title}</td>
                    <td className="px-4 py-2.5"><Badge className="border-blue-200 bg-blue-50 text-blue-800">{o.opportunity_type}</Badge></td>
                    <td className="px-4 py-2.5 text-gray-600">{o.deadline ? new Date(o.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{o.applicant_count}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={o.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-gray-100 text-gray-700'}>
                        {o.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
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
