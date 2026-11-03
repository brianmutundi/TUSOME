export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** UTF-8 BOM for Excel compatibility. */
export const CSV_BOM = '\uFEFF';

/** RFC 4180-style CSV with CRLF row separators. */
export interface CsvMeta {
  school?: string;
  title?: string;
  filters?: Record<string, string>;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[], meta?: CsvMeta): string {
  const lines: string[] = [];
  if (meta?.school) lines.push(escapeCell(meta.school));
  if (meta?.title) lines.push(escapeCell(meta.title));
  if (meta?.filters) {
    for (const [k, v] of Object.entries(meta.filters)) {
      lines.push(escapeCell(`${k}: ${v}`));
    }
  }
  if (lines.length > 0) lines.push('');
  lines.push(columns.map((column) => escapeCell(column.header)).join(','));
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(column.value(row))).join(','));
  }
  return CSV_BOM + lines.join('\r\n');
}

export function safeFilename(name: string, fallback = 'tusome-analytics'): string {
  const base = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return base || fallback;
}

export function timestampSlug(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

/**
 * Trigger a browser download. Extracted so UI code can be tested without
 * depending on object URLs, and so SSR renders never touch `document`.
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFilename(filename, 'export.csv');
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
