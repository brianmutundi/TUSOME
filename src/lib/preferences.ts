import type { ParentPreferences } from '@/lib/analytics/api';

export interface PreferenceRow {
  title: string;
  hint: string;
  inApp: keyof ParentPreferences;
  sms: keyof ParentPreferences;
}

/** The three reminder categories, in display order. */
export const PREFERENCE_ROWS: PreferenceRow[] = [
  {
    title: 'Homework due tomorrow',
    hint: 'A heads-up the day before homework is due.',
    inApp: 'homeworkDueTomorrow',
    sms: 'smsHomeworkDueTomorrow',
  },
  {
    title: 'Events and reminders',
    hint: 'School events coming up.',
    inApp: 'eventReminders',
    sms: 'smsEventReminders',
  },
  {
    title: 'Replies to my messages',
    hint: 'When the school answers a message you sent. In the app this controls the unread count.',
    inApp: 'replyNotifications',
    sms: 'smsReplyNotifications',
  },
];

/** True when at least one SMS choice is on. */
export function anySmsOn(p: ParentPreferences): boolean {
  return p.smsHomeworkDueTomorrow || p.smsEventReminders || p.smsReplyNotifications;
}
