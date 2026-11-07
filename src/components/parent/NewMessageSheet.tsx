'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { createMyThread, type ThreadAudience } from '@/lib/analytics/api';
import {
  MAX_MESSAGE_LENGTH,
  MAX_SUBJECT_LENGTH,
  audienceLabel,
  isMessagingDenied,
  isSendableBody,
  isSendableSubject,
  messagesErrorMessage,
} from '@/lib/messages';
import { firstName } from '@/lib/parent/portal';
import { useParent } from './ParentContext';

const fieldClass =
  'w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100';

/** Bottom sheet for starting a message to the class teacher, the bursar or the school office. */
export function NewMessageSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (threadId: string) => void }) {
  const { kids, child, messageOptions, reloadThreads } = useParent();
  const closeRef = useRef<HTMLButtonElement>(null);

  // While the options are still loading every child is offered and the server decides.
  const optionFor = (studentId: string) => messageOptions?.find((o) => o.studentId === studentId) ?? null;
  const canMessage = (studentId: string) => (messageOptions ? optionFor(studentId)?.canMessageSchool === true : true);
  const allowedKids = (kids ?? []).filter((k) => canMessage(k.studentId));

  const [studentId, setStudentId] = useState(() => (child && canMessage(child.studentId) ? child.studentId : allowedKids[0]?.studentId ?? ''));
  const [audience, setAudience] = useState<ThreadAudience>('class_teacher');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus moves to Close once, when the sheet opens; later re-renders must not steal it back.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const selected = allowedKids.find((k) => k.studentId === studentId) ?? allowedKids[0] ?? null;
  const teacherName = selected ? optionFor(selected.studentId)?.classTeacherName ?? null : null;
  const hasTeacherInfo = messageOptions !== null;
  const ready = selected !== null && isSendableSubject(subject) && isSendableBody(body);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !ready || sending) return;
    setSending(true);
    setError(null);
    try {
      const created = await createMyThread({
        studentId: selected.studentId,
        audience,
        subject: subject.trim(),
        body: body.trim(),
      });
      reloadThreads();
      onCreated(created.threadId);
    } catch (caught) {
      console.error('createMyThread failed:', caught);
      setError(
        isMessagingDenied(caught)
          ? 'The school has not turned on messaging for this child on your account. Please contact the school office.'
          : messagesErrorMessage(caught, 'Could not send your message. Check your connection and try again.')
      );
    } finally {
      setSending(false);
    }
  };

  const audiences: { value: ThreadAudience; hint: string }[] = [
    {
      value: 'class_teacher',
      hint: !hasTeacherInfo
        ? 'About learning and behaviour'
        : teacherName
          ? teacherName
          : 'No class teacher is assigned, so the school office will reply',
    },
    { value: 'bursar', hint: 'About fees and payments' },
    { value: 'admin', hint: 'Anything else' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-message-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="new-message-title" className="text-lg font-extrabold text-gray-900">New message</h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-xl bg-gray-100 text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {allowedKids.length === 0 ? (
          <p className="text-sm text-gray-700">
            The school has not turned on messaging for your account. Please contact the school office.
          </p>
        ) : (
          <form onSubmit={send} className="space-y-4">
            {allowedKids.length > 1 && (
              <div>
                <label htmlFor="msg-child" className="mb-1 block text-sm font-bold text-gray-900">About which child?</label>
                <select
                  id="msg-child"
                  value={selected?.studentId ?? ''}
                  onChange={(e) => setStudentId(e.target.value)}
                  className={`${fieldClass} min-h-[2.75rem]`}
                >
                  {allowedKids.map((k) => (
                    <option key={k.studentId} value={k.studentId}>{k.fullName}</option>
                  ))}
                </select>
              </div>
            )}

            <fieldset>
              <legend className="mb-1 text-sm font-bold text-gray-900">
                Send to{selected && allowedKids.length === 1 ? ` (about ${firstName(selected.fullName)})` : ''}
              </legend>
              <div className="space-y-2">
                {audiences.map((a) => {
                  const on = audience === a.value;
                  return (
                    <label
                      key={a.value}
                      className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 ${on ? 'border-brand-600 bg-brand-50' : 'border-gray-200 bg-white'}`}
                    >
                      <input
                        type="radio"
                        name="msg-audience"
                        value={a.value}
                        checked={on}
                        onChange={() => setAudience(a.value)}
                        className="h-5 w-5 accent-brand-600"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-gray-900">{audienceLabel(a.value)}</span>
                        <span className="block break-words text-xs text-gray-600">{a.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="msg-subject" className="mb-1 block text-sm font-bold text-gray-900">Subject</label>
              <input
                id="msg-subject"
                type="text"
                value={subject}
                maxLength={MAX_SUBJECT_LENGTH}
                onChange={(e) => setSubject(e.target.value)}
                className={`${fieldClass} min-h-[2.75rem]`}
              />
            </div>

            <div>
              <label htmlFor="msg-body" className="mb-1 block text-sm font-bold text-gray-900">Message</label>
              <textarea
                id="msg-body"
                rows={5}
                value={body}
                maxLength={MAX_MESSAGE_LENGTH}
                onChange={(e) => setBody(e.target.value)}
                className={`${fieldClass} py-2`}
              />
              <p className="mt-1 text-xs text-gray-500">{body.length}/{MAX_MESSAGE_LENGTH}. Text only. For an emergency, phone the school.</p>
            </div>

            {error && <p role="alert" className="text-sm font-medium text-danger-600">{error}</p>}

            <button
              type="submit"
              disabled={!ready || sending}
              className="flex min-h-[2.75rem] w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
