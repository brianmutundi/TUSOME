import type { ReactNode } from 'react';

/** Error text tied to a field through aria-describedby. Renders nothing when empty. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-red-700">
      {message}
    </p>
  );
}

/** Wraps one field and its error so grid layouts stay aligned. */
export function FieldBlock({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  rows = 4,
  maxLength,
  invalid,
  describedBy,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  maxLength?: number;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-50"
      />
    </div>
  );
}
