'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getMessageHistory,
  getMessageRecipients,
  getSmsGatewayConfig,
  isAbortError,
  logMessage,
  updateSmsStatus,
} from '@/lib/analytics/api';
import type { MessageLogRow, MessageRecipients, SmsGatewayConfig } from '@/lib/analytics/types';

const RECIPIENT_TYPES = [
  { value: 'all_parents', label: 'All Parents' },
  { value: 'all_teachers', label: 'All Teachers' },
  { value: 'all_staff', label: 'All Staff' },
  { value: 'specific_classes', label: 'Specific Classes' },
  { value: 'specific_students', label: 'Specific Students' },
  { value: 'specific_teachers', label: 'Specific Teachers' },
  { value: 'specific_staff', label: 'Specific Staff' },
  { value: 'keyed_in', label: 'Key in Phone Numbers' },
];

const MESSAGE_TYPES = [
  { value: 'text', label: 'Text Message' },
  { value: 'exam_results', label: 'Exam Results' },
  { value: 'fee_info', label: 'Fee Information' },
];

export default function MessagingPage() {
  const [recipients, setRecipients] = useState<MessageRecipients | null>(null);
  const [gatewayConfig, setGatewayConfig] = useState<SmsGatewayConfig | null>(null);
  const [messageHistory, setMessageHistory] = useState<MessageLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Compose form
  const [showCompose, setShowCompose] = useState(false);
  const [recipientType, setRecipientType] = useState('all_parents');
  const [messageType, setMessageType] = useState('text');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [keyedInPhones, setKeyedInPhones] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getMessageRecipients({ signal: controller.signal }),
      getMessageHistory(50, { signal: controller.signal }),
      getSmsGatewayConfig({ signal: controller.signal }),
    ])
      .then(([recipData, historyData, gatewayData]) => {
        if (!active) return;
        setRecipients(recipData);
        setMessageHistory(historyData);
        setGatewayConfig(gatewayData);
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load messaging data');
        setError(describeAnalyticsError(caught, 'Could not load messaging data.'));
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

  const selectedRecipientCount = useMemo(() => {
    if (!recipients) return 0;
    switch (recipientType) {
      case 'all_parents':
        return recipients.students.length;
      case 'all_teachers':
        return recipients.teachers.filter((t) => t.staff_type === 'TEACHER').length;
      case 'all_staff':
        return recipients.teachers.length;
      case 'specific_classes':
        return recipients.students.filter((s) =>
          selectedClassIds.has(s.class_name ?? '')
        ).length;
      case 'specific_students':
        return selectedStudentIds.size;
      case 'specific_teachers':
        return recipients.teachers.filter((t) => t.staff_type === 'TEACHER').length;
      case 'specific_staff':
        return recipients.teachers.length;
      case 'keyed_in':
        return keyedInPhones.split(/[\n,]/).filter((p) => p.trim().length > 0).length;
      default:
        return 0;
    }
  }, [recipients, recipientType, selectedClassIds, selectedStudentIds, keyedInPhones]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim()) {
      setActionError('Message body is required.');
      return;
    }

    setSending(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      let recipientIds: string[] = [];
      let phoneNumbers: string[] = [];

      if (recipientType === 'specific_students') {
        recipientIds = Array.from(selectedStudentIds);
      } else if (recipientType === 'keyed_in') {
        phoneNumbers = keyedInPhones
          .split(/[\n,]/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
      }

      const messageId = await logMessage(
        recipientType,
        recipientIds,
        messageType,
        subject || null,
        messageBody,
        phoneNumbers,
        selectedRecipientCount,
        0
      );

      setActionSuccess(`Message queued successfully (ID: ${messageId.slice(0, 8)}…).`);
      setShowCompose(false);
      setMessageBody('');
      setSubject('');
      setKeyedInPhones('');
      setSelectedStudentIds(new Set());
      setSelectedClassIds(new Set());
      setReloadToken((v) => v + 1);
    } catch (caught) {
      setActionError(describeAnalyticsError(caught, 'Could not send message.'));
    } finally {
      setSending(false);
    }
  };

  const recipientTypeLabel = (type: string) => {
    return RECIPIENT_TYPES.find((r) => r.value === type)?.label ?? type;
  };

  const messageTypeLabel = (type: string) => {
    return MESSAGE_TYPES.find((m) => m.value === type)?.label ?? type;
  };

  if (loading) {
    return <LoadingPanel label="Loading messaging…" />;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Alert tone="error" title="Could not load messaging">
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
            / Messaging &amp; SMS
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            Messaging &amp; SMS
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Compose and send SMS messages to parents, teachers, and staff. Track message history
            and credit usage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">
            Free SMS (Device SIM)
          </Badge>
          <Button variant="primary" onClick={() => setShowCompose((v) => !v)}>
            {showCompose ? 'Close Compose' : '+ Compose Message'}
          </Button>
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
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
          <Alert tone="success" title="Sent">
            {actionSuccess}
          </Alert>
        </div>
      )}

      {showCompose && (
        <Card className="mb-6">
          <CardHeader
            title="Compose Message"
            description="Select recipients, compose your message, and send"
          />
          <form onSubmit={handleSend} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                id="msg-recipient-type"
                label="Send To"
                value={recipientType}
                onChange={(e) => setRecipientType(e.target.value)}
              >
                {RECIPIENT_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="msg-message-type"
                label="Message Type"
                value={messageType}
                onChange={(e) => setMessageType(e.target.value)}
              >
                {MESSAGE_TYPES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </SelectField>
              <TextField
                id="msg-subject"
                label="Subject (optional)"
                placeholder="e.g. Term 1 Results"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {recipientType === 'specific_classes' && recipients && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Select Classes
                </p>
                <div className="flex flex-wrap gap-2">
                  {recipients.classes.map((c) => (
                    <label
                      key={c.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={selectedClassIds.has(c.id)}
                        onChange={(e) => {
                          setSelectedClassIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          });
                        }}
                      />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {recipientType === 'specific_students' && recipients && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Select Students ({selectedStudentIds.size} selected)
                </p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {recipients.students.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.has(s.id)}
                              onChange={(e) => {
                                setSelectedStudentIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(s.id);
                                  else next.delete(s.id);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td className="px-3 py-1.5 font-medium text-gray-900">
                            {s.name || 'Unnamed'}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">{s.admission_no}</td>
                          <td className="px-3 py-1.5 text-gray-500">
                            {s.class_name} {s.stream_name ? `· ${s.stream_name}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {recipientType === 'keyed_in' && (
              <div>
                <label
                  htmlFor="keyed-in-phones"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Phone Numbers (one per line or comma-separated)
                </label>
                <textarea
                  id="keyed-in-phones"
                  rows={4}
                  value={keyedInPhones}
                  onChange={(e) => setKeyedInPhones(e.target.value)}
                  placeholder="+254712345678, +254798765432"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="msg-body"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Message Body
              </label>
              <textarea
                id="msg-body"
                rows={5}
                required
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Type your message here…"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <p className="mt-1 text-xs text-gray-500">
                {messageBody.length} characters · Estimated recipients: {selectedRecipientCount}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowCompose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sending || selectedRecipientCount === 0}>
                {sending ? 'Sending…' : 'Send Message'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* SMS Gateway info */}
      {gatewayConfig && (
        <Card className="mb-6">
          <CardHeader
            title="SMS Gateway (Device SIM)"
            description="How SMS is sent from this system"
          />
          <div className="space-y-3 p-5 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Gateway Type
                </p>
                <p className="mt-0.5 font-medium text-gray-900">
                  {gatewayConfig.gateway_type === 'device_sim'
                    ? 'Device SIM (Android SmsManager)'
                    : gatewayConfig.gateway_type}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Companion App
                </p>
                <p className="mt-0.5 font-medium text-gray-900">
                  {gatewayConfig.companion_app}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Mechanism
                </p>
                <p className="mt-0.5 text-gray-700">{gatewayConfig.mechanism}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Max Batch Size
                </p>
                <p className="mt-0.5 font-medium text-gray-900">
                  {gatewayConfig.max_batch_size} messages
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Required Permissions
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {gatewayConfig.required_permissions.map((perm) => (
                  <Badge
                    key={perm}
                    className="border-gray-300 bg-gray-100 text-gray-700"
                  >
                    {perm}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge
                className={
                  gatewayConfig.supports_dual_sim
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-gray-300 bg-gray-100 text-gray-700'
                }
              >
                {gatewayConfig.supports_dual_sim ? 'Dual SIM ✓' : 'Single SIM'}
              </Badge>
              <Badge
                className={
                  gatewayConfig.supports_delivery_tracking
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-gray-300 bg-gray-100 text-gray-700'
                }
              >
                {gatewayConfig.supports_delivery_tracking
                  ? 'Delivery Tracking ✓'
                  : 'No Delivery Tracking'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500">
              {gatewayConfig.description}. Messages are queued in the database and
              sent by a companion Android device using the device&apos;s SIM card.
              Completely free — no per-message fees, no credit purchases needed.
            </p>
          </div>
        </Card>
      )}

      {/* Message history */}
      <Card>
        <CardHeader
          title="Message History"
          description={`${messageHistory.length} message${messageHistory.length === 1 ? '' : 's'} sent`}
        />
        {messageHistory.length === 0 ? (
          <EmptyState
            title="No messages sent yet"
            description="Compose and send your first message above."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Recipients
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Message
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Count
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Credits
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {messageHistory.map((m) => (
                  <tr key={m.message_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {m.sent_at
                        ? new Date(m.sent_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className="border-blue-200 bg-blue-50 text-blue-800">
                        {messageTypeLabel(m.message_type)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {recipientTypeLabel(m.recipient_type)}
                      {m.exam_name && (
                        <span className="block text-xs text-gray-500">{m.exam_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-800">
                      <div className="max-w-xs truncate" title={m.message_body}>
                        {m.subject && (
                          <span className="font-semibold">{m.subject}: </span>
                        )}
                        {m.message_body}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{m.recipient_count}</td>
                    <td className="px-4 py-2.5 text-gray-700">{m.credits_used}</td>
                    <td className="px-4 py-2.5">
                      <Badge
                        className={
                          m.status === 'sent' || m.status === 'delivered'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : m.status === 'failed'
                              ? 'border-red-200 bg-red-50 text-red-800'
                              : 'border-gray-300 bg-gray-100 text-gray-700'
                        }
                      >
                        {m.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
