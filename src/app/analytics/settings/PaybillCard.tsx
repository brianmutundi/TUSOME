'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, CardHeader, TextField } from '@/components/ui';
import { describeAnalyticsError, getSchoolPaybill, isAbortError, setSchoolPaybill } from '@/lib/analytics/api';

/** Staff field for the M-Pesa paybill number parents see on the Fees screen. */
export function PaybillCard() {
  const [value, setValue] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getSchoolPaybill({ signal: controller.signal })
      .then((v) => {
        setValue(v);
        setLoaded(true);
      })
      .catch((caught) => {
        if (controller.signal.aborted || isAbortError(caught)) return;
        setError(describeAnalyticsError(caught, 'Could not load the paybill number.'));
      });
    return () => controller.abort();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      setValue(await setSchoolPaybill(value));
      setSaved(true);
    } catch (caught) {
      setError(describeAnalyticsError(caught, 'Could not save the paybill number.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="M-Pesa Paybill"
        description="Shown to parents on the Fees screen. The account number is the learner's admission number. Leave empty to hide payment instructions."
      />
      <form onSubmit={save} className="space-y-3 p-5">
        <TextField
          id="school-paybill"
          label="Paybill number"
          inputMode="numeric"
          maxLength={7}
          placeholder="e.g. 522522"
          value={value}
          disabled={!loaded && !error}
          onChange={(e) => setValue(e.target.value)}
        />
        {error && <Alert tone="error" title="Not saved">{error}</Alert>}
        {saved && <Alert tone="success" title="Saved">Paybill number updated.</Alert>}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || (!loaded && !error)}>
            {saving ? 'Saving…' : 'Save paybill'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
