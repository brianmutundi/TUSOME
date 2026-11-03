import type { ReactNode } from 'react';

const TONES = [
  'bg-blue-100 text-blue-800',
  'bg-amber-100 text-amber-900',
  'bg-emerald-100 text-emerald-800',
  'bg-slate-200 text-slate-800',
  'bg-rose-100 text-rose-800',
];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

function toneFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
} as const;

/** Initials avatar. Decorative: the name is always rendered next to it. */
export function Avatar({ name, size = 'md' }: { name: string; size?: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${SIZES[size]} ${toneFor(name)}`}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * Identity block: avatar, name, one line of context and optional badges. Used for the signed-in
 * user's popover and for the header of a student or staff record.
 */
export function ProfileCard({
  name,
  subtitle,
  meta,
  badges,
  actions,
  size = 'md',
  className = '',
}: {
  name: string;
  subtitle?: string;
  /** Small label/value facts shown under the name (class, admission no., etc). */
  meta?: { label: string; value: ReactNode }[];
  badges?: ReactNode;
  actions?: ReactNode;
  size?: 'md' | 'lg';
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start gap-4 ${className}`}>
      <Avatar name={name} size={size === 'lg' ? 'lg' : 'md'} />
      <div className="min-w-0 flex-1">
        <p className={`truncate font-semibold text-gray-900 ${size === 'lg' ? 'text-xl' : 'text-sm'}`}>
          {name}
        </p>
        {subtitle && <p className="truncate text-sm text-gray-600">{subtitle}</p>}
        {badges && <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>}
        {meta && meta.length > 0 && (
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {meta.map((m) => (
              <div key={m.label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {m.label}
                </dt>
                <dd className="text-sm font-medium text-gray-900">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
