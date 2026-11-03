'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui';

const CLOSE_MS = 120;

/**
 * Accessible modal built on the native <dialog>: focus trap, Esc, inert background
 * and top-layer stacking come from the browser. Bottom sheet on phones (see globals.css).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      el.removeAttribute('data-closing');
      if (!el.open) el.showModal();
      return;
    }
    if (el.open) {
      el.setAttribute('data-closing', 'true');
      const t = window.setTimeout(() => {
        el.close();
        el.removeAttribute('data-closing');
      }, CLOSE_MS);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={`tusome-dialog ${size === 'lg' ? 'tusome-dialog-lg' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="px-6 pb-1 pt-5">
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        {description && (
          <p id={descId} className="mt-1 text-sm text-gray-600">
            {description}
          </p>
        )}
      </div>
      {children && <div className="px-6 py-3">{children}</div>}
      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-6 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}

/** Replaces window.confirm and unconfirmed destructive clicks. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Keep it',
  tone = 'danger',
  requirePhrase,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  /** When set, the user must type this exact phrase before the button enables. */
  requirePhrase?: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const inputId = useId();
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const ready = !requirePhrase || typed === requirePhrase;

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={() => void onConfirm()} disabled={!ready || busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      {description && <div className="text-sm text-gray-700">{description}</div>}
      {requirePhrase && (
        <div className="mt-4">
          <label
            htmlFor={inputId}
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500"
          >
            Type {requirePhrase} to confirm
          </label>
          <input
            id={inputId}
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault(); // dialogs can sit inside forms; never submit them
              if (ready && !busy) void onConfirm();
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      )}
    </Modal>
  );
}

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Radio group rendered as selectable cards. Native radios underneath, so arrow keys,
 * grouping and screen-reader semantics work; the selected state is shown by a filled
 * dot and a tinted border, never by colour alone.
 */
export function RadioCardGroup<T extends string>({
  legend,
  hideLegend = false,
  name,
  value,
  onChange,
  options,
  columns = 2,
  className = '',
}: {
  legend: string;
  hideLegend?: boolean;
  name: string;
  value: T;
  onChange: (next: T) => void;
  options: RadioOption<T>[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const cols = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3' }[
    columns
  ];
  return (
    <fieldset className={className}>
      <legend
        className={
          hideLegend
            ? 'sr-only'
            : 'mb-2 text-xs font-medium uppercase tracking-wide text-gray-500'
        }
      >
        {legend}
      </legend>
      <div className={`grid gap-2 ${cols}`}>
        {options.map((o) => (
          <label
            key={o.value}
            className={`relative block ${o.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <span
              aria-hidden="true"
              className="absolute left-3 top-3.5 h-[18px] w-[18px] rounded-full border-2 border-gray-400 bg-white transition-colors peer-checked:border-blue-600 peer-checked:bg-blue-600 peer-checked:shadow-[inset_0_0_0_3px_theme(colors.white)]"
            />
            <span className="block min-h-[3.25rem] rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 transition-[border-color,background-color,transform] duration-150 hover:border-gray-400 peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 peer-active:scale-[0.98]">
              <span className="block text-sm font-medium text-gray-900">{o.label}</span>
              {o.description && (
                <span className="block text-xs text-gray-600">{o.description}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Compact radio group for switching a view or filter (2-4 short options). Native radios
 * underneath; the selected segment is raised and filled, so it never relies on colour alone.
 */
export function SegmentedControl<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
  className = '',
}: {
  legend: string;
  name: string;
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex rounded-lg bg-gray-100 p-1">
        {options.map((o) => (
          <label key={o.value} className={`relative ${o.disabled ? 'opacity-50' : ''}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="flex min-h-[2.25rem] cursor-pointer items-center rounded-md px-3.5 text-sm font-medium text-gray-600 transition-colors peer-checked:bg-white peer-checked:font-semibold peer-checked:text-gray-900 peer-checked:shadow-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-blue-600 peer-disabled:cursor-not-allowed">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
