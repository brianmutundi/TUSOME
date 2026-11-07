'use client';

import { useEffect, useState } from 'react';
import { describeAnalyticsError, getMyPhone, setMyPhone } from '@/lib/analytics/api';
import { formatSavedPhone, isKenyanPhone } from '@/lib/parent/portal';
import { useParent } from '@/components/parent/ParentContext';
import { LoadFailure, TopBar, cardClass } from '@/components/parent/parts';
import { PREFERENCE_ROWS, anySmsOn } from '@/lib/preferences';
import type { ParentPreferences } from '@/lib/analytics/api';

function Switch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="-m-1 grid h-11 w-14 shrink-0 place-items-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50"
    >
      <span className={`flex h-7 w-12 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-brand-600' : 'bg-gray-300'}`}>
        <span className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

type PhoneState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; saved: string | null };

const SMS_KEYS = new Set<string>(PREFERENCE_ROWS.map((row) => row.sms));

function smsBlockedReason(phone: PhoneState): string | null {
  if (phone.status === 'loading') return 'Still checking your saved number. Try again in a moment.';
  if (phone.status === 'error') return 'Could not check your saved number. Reload the page and try again.';
  if (!phone.saved) return 'Save your M-Pesa number above before turning on SMS.';
  return null;
}

function Reminders({ phone }: { phone: PhoneState }) {
  const { preferences, preferencesError, reloadPreferences, savePreferences } = useParent();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (preferencesError && !preferences) return <LoadFailure message={preferencesError} onRetry={reloadPreferences} />;
  if (!preferences) return <p className="mt-2 text-[13px] text-gray-500" role="status">Loading your reminder settings…</p>;

  const change = async (key: keyof ParentPreferences, value: boolean) => {
    setError(null);
    if (value && SMS_KEYS.has(key)) {
      const blocked = smsBlockedReason(phone);
      if (blocked) {
        setError(blocked);
        return;
      }
    }
    setPending(key);
    try {
      await savePreferences({ [key]: value });
    } catch (caught) {
      console.error('savePreferences failed:', caught);
      setError(describeAnalyticsError(caught, 'Could not save that. Check your connection and try again.'));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mt-3">
      <ul className="divide-y divide-gray-100">
        {PREFERENCE_ROWS.map((row) => (
          <li key={row.title} className="py-3">
            <p className="text-sm font-bold text-gray-900">{row.title}</p>
            <p className="mt-0.5 text-[13px] text-gray-500">{row.hint}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">In the app</span>
              <Switch label={`${row.title}: in the app`} checked={preferences[row.inApp]} disabled={pending === row.inApp} onChange={(v) => change(row.inApp, v)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">By SMS</span>
              <Switch label={`${row.title}: by SMS`} checked={preferences[row.sms]} disabled={pending === row.sms} onChange={(v) => change(row.sms, v)} />
            </div>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-sm font-medium text-danger-600">{error}</p>}
      <p className="mt-2 text-xs text-gray-500">
        Your choices are saved. SMS is off unless you switch it on, and the school has not started sending SMS reminders yet
        {anySmsOn(preferences) ? ', so nothing will be texted for now' : ''}.
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const { email } = useParent();
  const [phone, setPhone] = useState('');
  const [phoneState, setPhoneState] = useState<PhoneState>({ status: 'loading' });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyPhone()
      .then((saved) => {
        if (cancelled) return;
        setPhoneState({ status: 'ready', saved });
        // Fill the box only if the parent has not started typing.
        if (saved) setPhone((current) => (current === '' ? formatSavedPhone(saved) : current));
      })
      .catch((caught) => {
        if (cancelled) return;
        console.error('getMyPhone failed:', caught);
        setPhoneState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const invalid = touched && !isKenyanPhone(phone);

  const save = async () => {
    setTouched(true);
    setResult(null);
    if (!isKenyanPhone(phone)) return;
    setSaving(true);
    try {
      const saved = await setMyPhone(phone);
      setPhoneState({ status: 'ready', saved });
      setResult({ ok: true, text: `Saved ${saved}. M-Pesa prompts will go to this number.` });
    } catch (caught) {
      setResult({ ok: false, text: describeAnalyticsError(caught, 'Could not save the number.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar eyebrow="Account" title="Profile" backHref="/parent/more" />
      <div className="space-y-4 px-5">
        <section className={`${cardClass} p-4`}>
          <p className="text-sm font-bold text-gray-900">Parent login</p>
          <p className="mt-0.5 break-words text-[13px] text-gray-500">
            Signed in as {email ?? 'your account'}. The school manages your password.
          </p>

          <label htmlFor="mpesa" className="mt-4 block text-[13px] font-bold text-gray-900">M-Pesa number</label>
          <input
            id="mpesa"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07XX XXX XXX"
            value={phone}
            aria-invalid={invalid}
            aria-describedby="mpesa-help"
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => phone && setTouched(true)}
            className={`mt-2 block min-h-[3rem] w-full rounded-xl border-[1.5px] bg-white px-3.5 text-base text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${invalid ? 'border-danger-600' : 'border-gray-200'}`}
          />
          <p id="mpesa-help" className={`mt-2 text-[13px] ${invalid ? 'font-semibold text-danger-600' : 'text-gray-500'}`}>
            {invalid ? 'Enter a valid Kenyan number, like 0712 345 678.' : 'Use 07XX or +2547XX format.'}
          </p>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-4 flex min-h-[3rem] w-full items-center justify-center rounded-2xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {saving ? 'Saving…' : 'Save number'}
          </button>
          {result && (
            <p role={result.ok ? 'status' : 'alert'} className={`mt-3 text-sm font-medium ${result.ok ? 'text-success-700' : 'text-danger-600'}`}>
              {result.text}
            </p>
          )}
        </section>

        <section className={`${cardClass} p-4`}>
          <p className="text-sm font-bold text-gray-900">Reminders</p>
          <p className="mt-0.5 text-[13px] text-gray-500">Choose which reminders you want, in the app and by SMS.</p>
          <Reminders phone={phoneState} />
        </section>
      </div>
    </>
  );
}
