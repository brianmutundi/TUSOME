'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingPanel,
  SelectField,
  StatCard,
  TextField,
} from '@/components/ui';
import {
  describeAnalyticsError,
  getReportTemplateConfig,
  getSchoolProfile,
  getSchoolValidity,
  getTermDates,
  isAbortError,
  setReportTemplateConfig,
  updateSchoolProfile,
  upsertTermDate,
} from '@/lib/analytics/api';
import type { ReportTemplateConfig, SchoolProfile, SchoolValidity, TermDateRow } from '@/lib/analytics/types';

type SettingsTab = 'profile' | 'term-dates' | 'printout-settings' | 'validity';

const CURRENT_YEAR = new Date().getFullYear();
const ACADEMIC_YEARS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
const TERMS = ['Term 1', 'Term 2', 'Term 3'];

const REPORT_TEMPLATE_KEYS: ReadonlyArray<{ key: string; label: string; description: string }> = [
  { key: 'watermark_size', label: 'Watermark Size', description: 'Size of the school watermark on report cards (small/medium/large).' },
  { key: 'show_fees', label: 'Show School Fees', description: 'Display fee balance on report cards.' },
  { key: 'show_term_dates', label: 'Show Term Dates', description: 'Display opening/closing dates on report cards.' },
  { key: 'show_signatures', label: 'Show Signatures', description: 'Display signature blocks (class teacher, principal, DOS, parent).' },
  { key: 'show_grade_descriptors', label: 'Show Grade Descriptors', description: 'Display grade descriptor table on report cards.' },
  { key: 'show_subject_comments', label: 'Show Subject Comments', description: 'Display per-subject teacher comments.' },
  { key: 'show_promotion_status', label: 'Show Promotion Status', description: 'Display promotion status on report cards.' },
  { key: 'report_orientation', label: 'Report Orientation', description: 'Portrait or landscape for printed report cards.' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [validity, setValidity] = useState<SchoolValidity | null>(null);
  const [termDates, setTermDates] = useState<TermDateRow[]>([]);
  const [templateConfig, setTemplateConfig] = useState<ReportTemplateConfig[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: '',
    schoolType: '',
    country: '',
    region: '',
    county: '',
    educationSystem: '',
    ownershipType: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    motto: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Term date form
  const [termDateForm, setTermDateForm] = useState({
    academicYear: CURRENT_YEAR,
    term: 'Term 1',
    openingDate: '',
    closingDate: '',
  });
  const [savingTermDate, setSavingTermDate] = useState(false);

  // Template config form
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getSchoolProfile({ signal: controller.signal }),
      getSchoolValidity({ signal: controller.signal }),
      getTermDates(undefined, undefined, { signal: controller.signal }),
      getReportTemplateConfig({ signal: controller.signal }),
    ])
      .then(([profileData, validityData, termDateRows, configRows]) => {
        if (!active) return;
        setProfile(profileData);
        setValidity(validityData);
        setTermDates(termDateRows);
        setTemplateConfig(configRows);

        setProfileForm({
          name: profileData.name,
          schoolType: profileData.school_type ?? '',
          country: profileData.country ?? '',
          region: profileData.region ?? '',
          county: profileData.county ?? '',
          educationSystem: profileData.education_system ?? '',
          ownershipType: profileData.ownership_type ?? '',
          contactPerson: profileData.contact_person ?? '',
          contactPhone: profileData.contact_phone ?? '',
          contactEmail: profileData.contact_email ?? '',
          motto: profileData.motto ?? '',
        });

        const configMap: Record<string, string> = {};
        for (const c of configRows) {
          configMap[c.config_key] = c.config_value;
        }
        setConfigForm(configMap);
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load settings');
        setError(describeAnalyticsError(caught, 'Could not load school settings.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  const refresh = useCallback(() => {
    setActionError(null);
    setActionSuccess(null);
    setReloadToken((v) => v + 1);
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await updateSchoolProfile(profileForm);
      setActionSuccess('School profile updated.');
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not update school profile.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveTermDate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTermDate(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await upsertTermDate(
        termDateForm.academicYear,
        termDateForm.term,
        termDateForm.openingDate,
        termDateForm.closingDate
      );
      setActionSuccess(`Term date saved for ${termDateForm.term} ${termDateForm.academicYear}.`);
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save term date.'));
    } finally {
      setSavingTermDate(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      for (const [key, value] of Object.entries(configForm)) {
        if (value.trim()) {
          await setReportTemplateConfig(key, value.trim());
        }
      }
      setActionSuccess('Report template settings saved.');
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not save template settings.'));
    } finally {
      setSavingConfig(false);
    }
  };

  const subscriptionBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'border-emerald-200 bg-emerald-50 text-emerald-800';
      case 'trial':
        return 'border-blue-200 bg-blue-50 text-blue-800';
      case 'expired':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'suspended':
        return 'border-amber-200 bg-amber-50 text-amber-800';
      default:
        return 'border-gray-300 bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return <LoadingPanel label="Loading school settings…" />;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load settings">
          {error}
        </Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">
              Analytics
            </Link>{' '}
            / School Settings
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            School Settings
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Manage school profile, term dates, and report template configuration.
          </p>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={loading}>
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        {(
          [
            ['profile', 'School Profile'],
            ['term-dates', 'Term Dates'],
            ['printout-settings', 'Printout Settings'],
            ['validity', 'Subscription Status'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="mb-4">
          <Alert tone="error" title="Action failed">
            {actionError}
          </Alert>
        </div>
      )}

      {actionSuccess && (
        <div className="mb-4">
          <Alert tone="success" title="Saved">
            {actionSuccess}
          </Alert>
        </div>
      )}

      {activeTab === 'profile' && profile && (
        <Card>
          <CardHeader
            title="School Profile"
          />
          <form onSubmit={handleSaveProfile} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <TextField
              id="school-name"
              label="School Name"
              required
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
            />
            <TextField
              id="school-type"
              label="School Type"
              placeholder="e.g. Primary, Secondary"
              value={profileForm.schoolType}
              onChange={(e) => setProfileForm({ ...profileForm, schoolType: e.target.value })}
            />
            <TextField
              id="school-country"
              label="Country"
              value={profileForm.country}
              onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
            />
            <TextField
              id="school-region"
              label="Region"
              value={profileForm.region}
              onChange={(e) => setProfileForm({ ...profileForm, region: e.target.value })}
            />
            <TextField
              id="school-county"
              label="County"
              value={profileForm.county}
              onChange={(e) => setProfileForm({ ...profileForm, county: e.target.value })}
            />
            <TextField
              id="school-education-system"
              label="Education System"
              placeholder="e.g. 8-4-4, CBC, IGCSE"
              value={profileForm.educationSystem}
              onChange={(e) =>
                setProfileForm({ ...profileForm, educationSystem: e.target.value })
              }
            />
            <TextField
              id="school-ownership-type"
              label="Ownership Type"
              placeholder="e.g. Public, Private"
              value={profileForm.ownershipType}
              onChange={(e) =>
                setProfileForm({ ...profileForm, ownershipType: e.target.value })
              }
            />
            <TextField
              id="school-contact-person"
              label="Contact Person"
              value={profileForm.contactPerson}
              onChange={(e) =>
                setProfileForm({ ...profileForm, contactPerson: e.target.value })
              }
            />
            <TextField
              id="school-contact-phone"
              label="Contact Phone"
              value={profileForm.contactPhone}
              onChange={(e) =>
                setProfileForm({ ...profileForm, contactPhone: e.target.value })
              }
            />
            <TextField
              id="school-contact-email"
              label="Contact Email"
              type="email"
              value={profileForm.contactEmail}
              onChange={(e) =>
                setProfileForm({ ...profileForm, contactEmail: e.target.value })
              }
            />
            <TextField
              id="school-motto"
              label="School Motto"
              className="sm:col-span-2 lg:col-span-3"
              value={profileForm.motto}
              onChange={(e) => setProfileForm({ ...profileForm, motto: e.target.value })}
            />
            <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save School Profile'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {activeTab === 'term-dates' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Set Term Dates"
            />
            <form onSubmit={handleSaveTermDate} className="flex flex-wrap items-end gap-3 p-5">
              <SelectField
                id="term-date-year"
                label="Academic Year"
                value={termDateForm.academicYear}
                onChange={(e) =>
                  setTermDateForm({ ...termDateForm, academicYear: Number(e.target.value) })
                }
              >
                {ACADEMIC_YEARS.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="term-date-term"
                label="Term"
                value={termDateForm.term}
                onChange={(e) => setTermDateForm({ ...termDateForm, term: e.target.value })}
              >
                {TERMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </SelectField>
              <TextField
                id="term-date-opening"
                label="Opening Date"
                type="date"
                required
                value={termDateForm.openingDate}
                onChange={(e) =>
                  setTermDateForm({ ...termDateForm, openingDate: e.target.value })
                }
              />
              <TextField
                id="term-date-closing"
                label="Closing Date"
                type="date"
                required
                value={termDateForm.closingDate}
                onChange={(e) =>
                  setTermDateForm({ ...termDateForm, closingDate: e.target.value })
                }
              />
              <Button type="submit" disabled={savingTermDate}>
                {savingTermDate ? 'Saving…' : 'Save Term Date'}
              </Button>
            </form>
          </Card>

          <Card>

             <CardHeader title="Configured Term Dates" />

            {termDates.length === 0 ? (
              <EmptyState
                title="No term dates configured"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Academic Year
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Term
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Opening Date
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Closing Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {termDates.map((td) => (
                      <tr key={td.term_date_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {td.academic_year}
                        </td>
                        <td className="px-4 py-2.5 text-gray-800">{td.term}</td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {new Date(td.opening_date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {new Date(td.closing_date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'printout-settings' && (
        <Card>
          <CardHeader
            title="Printout / Report Template Settings"
          />
          <form onSubmit={handleSaveConfig} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Report Content group */}
              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Report Content</h3>
                {['show_fees', 'show_term_dates', 'show_signatures', 'show_grade_descriptors', 'show_subject_comments', 'show_promotion_status'].map((key) => {
                  const item = REPORT_TEMPLATE_KEYS.find((k) => k.key === key)!;
                  const checked = configForm[key] === 'true' || configForm[key] === '1' || configForm[key] === 'yes';
                  return (
                    <label key={key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-700">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, [key]: e.target.checked ? 'true' : 'false' })
                        }
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  );
                })}
              </div>

              {/* Print Layout group */}
              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Print Layout</h3>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Watermark Size</label>
                  <select
                    value={configForm['watermark_size'] ?? 'medium'}
                    onChange={(e) => setConfigForm({ ...configForm, watermark_size: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Report Orientation</label>
                  <div className="mt-1 flex gap-2">
                    {['portrait', 'landscape'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConfigForm({ ...configForm, report_orientation: v })}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                          (configForm['report_orientation'] ?? 'portrait') === v
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-300 bg-white text-gray-700'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingConfig}>
                {savingConfig ? 'Saving…' : 'Save Template Settings'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {activeTab === 'validity' && validity && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="School"
              value={validity.name}
            />
            <StatCard
              label="Validity Status"
              value={
                <Badge className={subscriptionBadgeClass(validity.subscription_status)}>
                  {validity.subscription_status}
                </Badge>
              }
            />
            <StatCard
              label="Subscription Valid"
              value={validity.is_valid ? 'Yes' : 'No'}
            />
            <StatCard
              label="Days Remaining"
              value={validity.days_remaining ?? '—'}
              hint={
                validity.is_expired
                  ? 'Subscription has expired'
                  : validity.subscription_expires_at
                    ? `Expires ${new Date(validity.subscription_expires_at).toLocaleDateString('en-GB')}`
                    : 'No expiry set'
              }
            />
          </div>

          <Card>
            <CardHeader
              title="Subscription & Validity (Zeraki accountLock parity)"
            />
            <div className="grid gap-3 p-5 text-sm text-gray-600 md:grid-cols-2">
              <p>
                <strong className="font-semibold text-gray-800">Status:</strong>{' '}
                {validity.is_valid
                  ? 'Your school subscription is active and all features are available.'
                  : 'Your school subscription has expired or is suspended. Contact your account manager to renew.'}
              </p>
              <p>
                <strong className="font-semibold text-gray-800">Expiry:</strong>{' '}
                {validity.subscription_expires_at
                  ? new Date(validity.subscription_expires_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'No expiry date set (trial or lifetime).'}
              </p>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
