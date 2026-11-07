import { daysUntil, relativeDayLabel } from '@/lib/parent/portal';
import type { EventRow } from '@/lib/analytics/types';
import { cardClass } from './parts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function EventRowItem({ event }: { event: EventRow }) {
  const start = new Date(event.start_date);
  const valid = !Number.isNaN(start.getTime());
  const time = !event.is_all_day && valid ? start.toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' }) : 'All day';
  return (
    <li className={`${cardClass} flex items-center gap-3 p-3.5`}>
      <div className="w-14 shrink-0 rounded-xl bg-brand-50 py-1.5 text-center text-brand-600" aria-hidden="true">
        <b className="block text-xl font-extrabold leading-tight">{valid ? start.getDate() : '–'}</b>
        <span className="text-xs font-bold">{valid ? MONTHS[start.getMonth()] : ''}</span>
      </div>
      <div className="min-w-0">
        <p className="break-words text-sm font-bold text-gray-900">{event.title}</p>
        <p className="text-xs text-gray-500">
          {valid ? start.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' }) : ''} · {time}
          {event.location ? ` · ${event.location}` : ''} · {relativeDayLabel(daysUntil(event.start_date))}
        </p>
      </div>
    </li>
  );
}
