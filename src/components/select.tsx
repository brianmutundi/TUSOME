'use client';

import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Popover } from '@/components/popover';

interface Opt {
  value: string;
  label: string;
  disabled: boolean;
}

function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
    .join('');
}

function collect(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    if (child.type === 'option') {
      const label = textOf(props.children);
      out.push({
        value: props.value === undefined ? label : String(props.value),
        label,
        disabled: Boolean(props.disabled),
      });
    } else if (child.type === 'optgroup' || child.type === Fragment) {
      out.push(...collect(props.children));
    }
  });
  return out;
}

const SEARCH_THRESHOLD = 8;

/**
 * Drop-in replacement for the old native-select field. A real <select> stays in the DOM
 * (hidden from assistive tech) so forms, `name`, `required` and `onChange(event)` consumers
 * keep working; people interact with a popover listbox that has keyboard support, a search
 * box for long lists, and 44px rows on touch screens.
 */
export function SelectField({
  label,
  id,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string }) {
  const options = useMemo(() => collect(children), [children]);
  const nativeRef = useRef<HTMLSelectElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [inner, setInner] = useState<string>(
    props.defaultValue !== undefined ? String(props.defaultValue) : (options[0]?.value ?? '')
  );
  const value = props.value !== undefined ? String(props.value) : inner;
  const selected = options.find((o) => o.value === value) ?? options[0];
  const valueId = useId();
  const listboxId = useId();

  const choose = (next: string) => {
    const native = nativeRef.current;
    if (native) {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      setter?.call(native, next);
      native.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setInner(next);
  };

  return (
    <div className={`w-full sm:min-w-[10rem] sm:flex-1 ${className}`}>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500"
        onClick={(event) => {
          event.preventDefault();
          if (!props.disabled) buttonRef.current?.click();
        }}
      >
        {label}
      </label>
      <select
        ref={nativeRef}
        id={id}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onFocus={() => buttonRef.current?.focus()}
        {...props}
      >
        {children}
      </select>
      <Popover
        role="listbox"
        label={label}
        matchWidth
        initialFocus="none"
        className="overflow-hidden"
        trigger={({ props: trigger, open }) => (
          <button
            {...trigger}
            ref={(node) => {
              buttonRef.current = node;
              trigger.ref(node);
            }}
            type="button"
            role="combobox"
            aria-label={`${label}: ${selected?.label ?? 'none'}`}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            disabled={props.disabled}
            data-open={open || undefined}
            className="flex min-h-[2.5rem] w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 transition-colors hover:border-gray-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 data-[open]:border-blue-500 data-[open]:ring-2 data-[open]:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
          >
            <span id={valueId} className="truncate">
              {selected?.label || '—'}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      >
        {({ close }) => (
          <Listbox
            id={listboxId}
            options={options}
            value={value}
            label={label}
            onPick={(next) => {
              choose(next);
              close();
              buttonRef.current?.focus();
            }}
          />
        )}
      </Popover>
    </div>
  );
}

function Listbox({
  id,
  options,
  value,
  label,
  onPick,
}: {
  id?: string;
  options: Opt[];
  value: string;
  label: string;
  onPick: (value: string) => void;
}) {
  const baseId = useId();
  const searchable = options.length > SEARCH_THRESHOLD;
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const [active, setActive] = useState(() =>
    Math.max(0, options.findIndex((o) => o.value === value))
  );
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (searchable ? searchRef.current : wrapRef.current)?.focus({ preventScroll: true });
  }, [searchable]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [active, visible]);

  const move = (delta: number) => {
    if (visible.length === 0) return;
    let next = active;
    for (let i = 0; i < visible.length; i++) {
      next = (next + delta + visible.length) % visible.length;
      if (!visible[next].disabled) break;
    }
    setActive(next);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(Math.max(0, visible.length - 1));
    } else if (event.key === 'Enter' || (event.key === ' ' && !searchable)) {
      event.preventDefault();
      const option = visible[active];
      if (option && !option.disabled) onPick(option.value);
    }
  };

  return (
    <div ref={wrapRef} tabIndex={-1} onKeyDown={onKeyDown} className="outline-none">
      {searchable && (
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
          <Search aria-hidden="true" className="h-4 w-4 text-gray-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            aria-label={`Search ${label}`}
            aria-controls={`${baseId}-list`}
            aria-activedescendant={visible[active] ? `${baseId}-${active}` : undefined}
            placeholder="Search…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>
      )}
      <ul
        ref={listRef}
        id={id ?? `${baseId}-list`}
        role="presentation"
        className="max-h-64 overflow-y-auto p-1"
      >
        {visible.length === 0 && (
          <li className="px-3 py-3 text-sm text-gray-500">No matches</li>
        )}
        {visible.map((option, index) => {
          const isSelected = option.value === value;
          return (
            <li
              key={option.value + index}
              id={`${baseId}-${index}`}
              data-index={index}
              role="option"
              aria-selected={isSelected}
              aria-disabled={option.disabled || undefined}
              onMouseMove={() => setActive(index)}
              onClick={() => !option.disabled && onPick(option.value)}
              className={`flex min-h-[2.5rem] cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                index === active ? 'bg-gray-100' : ''
              } ${isSelected ? 'font-semibold text-blue-800' : 'text-gray-800'} ${
                option.disabled ? 'cursor-not-allowed opacity-50' : ''
              }`}
            >
              <span className="min-w-0 break-words">{option.label || '—'}</span>
              {isSelected && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-700" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
