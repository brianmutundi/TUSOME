import { describe, expect, it } from 'vitest';
import { AnalyticsAPIError } from '@/lib/analytics/errors';
import {
  audienceLabel,
  formatClock,
  formatMessageTime,
  formatThreadTime,
  isMessagingDenied,
  isSendableBody,
  isSendableSubject,
  messagesErrorMessage,
  newestMessageTime,
  previewText,
  unreadThreadCount,
} from './messages';

// Local-time constructors keep these tests independent of the machine's time zone.
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const NOW = new Date(2026, 10, 5, 15, 30); // 5 Nov 2026, 3:30 pm

describe('audienceLabel', () => {
  it('names the three inboxes', () => {
    expect(audienceLabel('class_teacher')).toBe('Class teacher');
    expect(audienceLabel('bursar')).toBe('Bursar');
    expect(audienceLabel('admin')).toBe('School office');
  });
});

describe('isSendableBody / isSendableSubject', () => {
  it('rejects blank and whitespace-only text', () => {
    expect(isSendableBody('')).toBe(false);
    expect(isSendableBody('   \n ')).toBe(false);
    expect(isSendableSubject('  ')).toBe(false);
  });
  it('accepts up to the limits after trimming and rejects beyond', () => {
    expect(isSendableBody('x'.repeat(1000))).toBe(true);
    expect(isSendableBody(` ${'x'.repeat(1000)} `)).toBe(true);
    expect(isSendableBody('x'.repeat(1001))).toBe(false);
    expect(isSendableSubject('x'.repeat(120))).toBe(true);
    expect(isSendableSubject('x'.repeat(121))).toBe(false);
  });
});

describe('unreadThreadCount', () => {
  it('counts unread threads and treats null as none', () => {
    expect(unreadThreadCount(null)).toBe(0);
    expect(unreadThreadCount([])).toBe(0);
    expect(unreadThreadCount([{ isUnread: true }, { isUnread: false }, { isUnread: true }])).toBe(2);
  });
});

describe('previewText', () => {
  it('collapses newlines and repeated spaces', () => {
    expect(previewText('  Hello\n\n  there   Ms Wanjiku ')).toBe('Hello there Ms Wanjiku');
  });
});

describe('newestMessageTime', () => {
  it('returns the latest valid time regardless of order', () => {
    const a = at(2026, 11, 3, 9, 0);
    const b = at(2026, 11, 4, 9, 0);
    expect(newestMessageTime([{ createdAt: b }, { createdAt: a }])).toBe(b);
  });
  it('ignores unreadable times and returns null for nothing', () => {
    expect(newestMessageTime([])).toBeNull();
    expect(newestMessageTime([{ createdAt: 'nope' }])).toBeNull();
    const a = at(2026, 11, 3, 9, 0);
    expect(newestMessageTime([{ createdAt: 'nope' }, { createdAt: a }])).toBe(a);
  });
});

describe('time formatting', () => {
  it('formats a 12-hour clock including midnight and noon', () => {
    expect(formatClock(at(2026, 11, 5, 0, 5))).toBe('12:05 am');
    expect(formatClock(at(2026, 11, 5, 12, 0))).toBe('12:00 pm');
    expect(formatClock(at(2026, 11, 5, 14, 5))).toBe('2:05 pm');
    expect(formatClock('garbage')).toBe('');
  });
  it('shows the clock today, Yesterday, a weekday inside a week, then a date', () => {
    expect(formatThreadTime(at(2026, 11, 5, 8, 0), NOW)).toBe('8:00 am');
    expect(formatThreadTime(at(2026, 11, 4, 23, 0), NOW)).toBe('Yesterday');
    expect(formatThreadTime(at(2026, 11, 2, 10, 0), NOW)).toBe('Mon');
    expect(formatThreadTime(at(2026, 10, 29, 10, 0), NOW)).toBe('29 Oct');
    expect(formatThreadTime('garbage', NOW)).toBe('');
  });
  it('adds the date to message times from other days', () => {
    expect(formatMessageTime(at(2026, 11, 5, 9, 15), NOW)).toBe('9:15 am');
    expect(formatMessageTime(at(2026, 11, 3, 14, 5), NOW)).toBe('3 Nov, 2:05 pm');
  });
});

describe('messagesErrorMessage', () => {
  it('shows the server text for the messages the RPCs raise on purpose', () => {
    const limit = new AnalyticsAPIError('SERVER_ERROR', "You have reached today's limit of 10 new messages.");
    expect(messagesErrorMessage(limit, 'fallback')).toBe("You have reached today's limit of 10 new messages.");
  });
  it('shows the daily message caps through the real Supabase error mapping', () => {
    for (const text of [
      "You have reached today's limit of 30 messages. Please try again tomorrow.",
      "You have reached today's limit of 200 replies. Please try again tomorrow.",
    ]) {
      const err = AnalyticsAPIError.fromSupabaseError({ code: 'P0001', message: text });
      expect(messagesErrorMessage(err, 'fallback')).toBe(text);
    }
    const closed = new AnalyticsAPIError('SERVER_ERROR', 'This conversation is closed. Reopen it to reply.');
    expect(messagesErrorMessage(closed, 'fallback')).toBe('This conversation is closed. Reopen it to reply.');
    const empty = new AnalyticsAPIError('VALIDATION_ERROR', 'Message is required (up to 1000 characters)');
    expect(messagesErrorMessage(empty, 'fallback')).toBe('Message is required (up to 1000 characters)');
  });
  it('never shows other server text', () => {
    const odd = new AnalyticsAPIError('SERVER_ERROR', 'relation "parent_threads" does not exist');
    expect(messagesErrorMessage(odd, 'Could not send.')).toBe('Could not send.');
    expect(messagesErrorMessage(new Error('boom'), 'Could not send.')).toBe('Could not send.');
  });
  it('maps not-found and denied by code', () => {
    expect(messagesErrorMessage(new AnalyticsAPIError('NOT_FOUND', 'Student not found'), 'x')).toBe('That conversation is no longer available.');
    expect(messagesErrorMessage(new AnalyticsAPIError('ACCESS_DENIED', 'Permission denied'), 'x')).toBe('You do not have access to do that.');
  });
  it('flags a denied error for the no-messaging message', () => {
    expect(isMessagingDenied(new AnalyticsAPIError('ACCESS_DENIED', 'Permission denied'))).toBe(true);
    expect(isMessagingDenied(new AnalyticsAPIError('NOT_FOUND', 'x'))).toBe(false);
    expect(isMessagingDenied(new Error('x'))).toBe(false);
  });
});
