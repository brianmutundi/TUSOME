'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type PopoverSide = 'bottom' | 'top' | 'right';
export type PopoverAlign = 'start' | 'end';
export type PopoverRole = 'dialog' | 'menu' | 'listbox';

export interface PopoverTriggerProps {
  ref: (node: HTMLButtonElement | null) => void;
  'aria-haspopup': 'dialog' | 'menu' | 'listbox';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
  onClick: () => void;
}

const GAP = 6;
const EDGE = 8;

function place(
  anchor: DOMRect,
  panel: { width: number; height: number },
  side: PopoverSide,
  align: PopoverAlign
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top: number;
  let left: number;

  if (side === 'right') {
    left = anchor.right + GAP;
    top = anchor.top;
    if (left + panel.width > vw - EDGE) left = Math.max(EDGE, anchor.left - GAP - panel.width);
  } else {
    top = side === 'bottom' ? anchor.bottom + GAP : anchor.top - GAP - panel.height;
    const fitsBelow = anchor.bottom + GAP + panel.height <= vh - EDGE;
    const fitsAbove = anchor.top - GAP - panel.height >= EDGE;
    if (side === 'bottom' && !fitsBelow && fitsAbove) top = anchor.top - GAP - panel.height;
    if (side === 'top' && !fitsAbove && fitsBelow) top = anchor.bottom + GAP;
    left = align === 'end' ? anchor.right - panel.width : anchor.left;
  }

  left = Math.min(Math.max(EDGE, left), Math.max(EDGE, vw - panel.width - EDGE));
  top = Math.min(Math.max(EDGE, top), Math.max(EDGE, vh - panel.height - EDGE));
  return { top, left };
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Anchored popover. The panel is portalled to the nearest <dialog> (or <body>) and positioned
 * with `position: fixed`, so table wrappers and modal scroll areas never clip it. Closes on Esc
 * (focus returns to the trigger), outside press, and when a link or [data-popover-close]
 * element inside it is activated.
 */
export function Popover({
  trigger,
  children,
  side = 'bottom',
  align = 'start',
  role = 'dialog',
  label,
  matchWidth = false,
  initialFocus = 'first',
  className = '',
  open: controlledOpen,
  onOpenChange,
}: {
  trigger: (ctx: { props: PopoverTriggerProps; open: boolean }) => ReactNode;
  children: ReactNode | ((ctx: { close: () => void }) => ReactNode);
  side?: PopoverSide;
  align?: PopoverAlign;
  role?: PopoverRole;
  label: string;
  matchWidth?: boolean;
  /** 'first' focuses the first control in the panel; 'none' leaves focus to the children. */
  initialFocus?: 'first' | 'none';
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const setTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    triggerRef.current = node;
  }, []);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const [host, setHost] = useState<HTMLElement | null>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInnerOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange]
  );
  const close = useCallback(() => setOpen(false), [setOpen]);

  const reposition = useCallback(() => {
    const anchor = triggerRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const rect = anchor.getBoundingClientRect();
    const next = place(
      rect,
      { width: panel.offsetWidth, height: panel.offsetHeight },
      side,
      align
    );
    setStyle({
      position: 'fixed',
      top: next.top,
      left: next.left,
      minWidth: matchWidth ? rect.width : undefined,
      visibility: 'visible',
    });
  }, [side, align, matchWidth]);

  useLayoutEffect(() => {
    if (!open) {
      setStyle({ visibility: 'hidden' });
      return;
    }
    setHost((triggerRef.current?.closest('dialog') as HTMLElement | null) ?? document.body);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !host) return;
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, host, reposition]);

  useEffect(() => {
    if (!open || !host || initialFocus !== 'first') return;
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel).focus({ preventScroll: true });
  }, [open, host, initialFocus]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      close();
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'Tab' && role === 'menu') {
      close();
      return;
    }
    if (event.key === 'Tab' && role === 'dialog') {
      // Tab moves through the panel, and leaving either end dismisses it (no focus trap).
      const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      const current = document.activeElement as HTMLElement | null;
      const leavingEnd = event.shiftKey
        ? current === nodes[0] || current === panelRef.current
        : current === nodes[nodes.length - 1];
      if (nodes.length === 0 || leavingEnd) close();
      return;
    }
    if (role !== 'menu') return;
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ??
        []
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % items.length;
    if (event.key === 'ArrowUp') nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = items.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      items[nextIndex].focus();
    }
  };

  const triggerProps: PopoverTriggerProps = {
    ref: setTriggerRef,
    'aria-haspopup': role,
    'aria-expanded': open,
    'aria-controls': open ? panelId : undefined,
    onClick: () => setOpen(!open),
  };

  return (
    <>
      {trigger({ props: triggerProps, open })}
      {open &&
        host &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role={role}
            aria-label={label}
            tabIndex={-1}
            style={style}
            data-side={side}
            onKeyDown={onPanelKeyDown}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('a[href],[data-popover-close]')) close();
            }}
            className={`tusome-popover z-[70] max-w-[calc(100vw-1rem)] rounded-xl border border-gray-200 bg-white text-gray-900 shadow-lg outline-none print:hidden ${className}`}
          >
            {typeof children === 'function' ? children({ close }) : children}
          </div>,
          host
        )}
    </>
  );
}

/** Row styling shared by menu entries (links and buttons). */
export const menuItemClass =
  'flex w-full min-h-[2.5rem] items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 aria-[current=page]:bg-blue-50 aria-[current=page]:text-blue-800 disabled:opacity-50';
