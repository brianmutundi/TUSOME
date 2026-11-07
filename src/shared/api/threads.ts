/** Thread mapping shared by the parent portal and staff inbox. */

import { textOrNull } from '../utils/text';
import type { ThreadAudience, ThreadMessage } from '../types/contracts';

export function toAudience(value: unknown): ThreadAudience {
  return value === 'bursar' || value === 'admin' ? value : 'class_teacher';
}

export function mapThreadMessage(r: Record<string, unknown>): ThreadMessage {
  return {
    messageId: String(r.message_id),
    senderKind: r.sender_kind === 'staff' ? 'staff' : 'parent',
    senderName: textOrNull(r.sender_name),
    body: String(r.body ?? ''),
    createdAt: String(r.created_at ?? ''),
  };
}
