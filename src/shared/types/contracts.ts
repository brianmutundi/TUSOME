/** Cross-feature contract types shared by more than one feature. */


/** Who a parent can address a message to. */
export type ThreadAudience = 'class_teacher' | 'bursar' | 'admin';

export interface ThreadMessage {
  messageId: string;
  senderKind: 'parent' | 'staff';
  senderName: string | null;
  body: string;
  createdAt: string;
}

/** One thread in the staff inbox. */
export interface InboxThread {
  threadId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  className: string | null;
  parentName: string | null;
  relationship: string | null;
  audience: ThreadAudience;
  subject: string;
  status: 'open' | 'closed';
  flagged: boolean;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastSenderKind: 'parent' | 'staff' | null;
  /** A parent message no staff member has opened yet. */
  isUnread: boolean;
  createdAt: string;
}

/** A parent's reminder choices. In-app defaults on; SMS is opt-in (off). Stored choices only. */
export interface ParentPreferences {
  homeworkDueTomorrow: boolean;
  eventReminders: boolean;
  replyNotifications: boolean;
  smsHomeworkDueTomorrow: boolean;
  smsEventReminders: boolean;
  smsReplyNotifications: boolean;
}

export interface ParentReceipt {
  receipt_id: string;
  receipt_number: string;
  amount_paid: number;
  payment_method: string;
  reference_number: string | null;
  paid_at: string;
  paid_by: string | null;
}
