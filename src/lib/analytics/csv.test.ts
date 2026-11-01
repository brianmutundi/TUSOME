import { describe, expect, it } from 'vitest';
import { safeFilename, timestampSlug, toCsv } from './csv';

describe('toCsv', () => {
  it('writes a header and CRLF-separated rows', () => {
    const csv = toCsv(
      [
        { name: 'Alice', score: 76 },
        { name: 'Bob', score: 90 },
      ],
      [
        { header: 'Student', value: (row) => row.name },
        { header: 'Score', value: (row) => row.score },
      ]
    );
    expect(csv).toBe('Student,Score\r\nAlice,76\r\nBob,90');
  });

  it('quotes commas, quotes and line breaks', () => {
    const csv = toCsv(
      [{ text: 'A, B', quote: 'say "hi"', lines: 'one\ntwo' }],
      [
        { header: 'Text', value: (row) => row.text },
        { header: 'Quote', value: (row) => row.quote },
        { header: 'Lines', value: (row) => row.lines },
      ]
    );
    expect(csv).toBe('Text,Quote,Lines\r\n"A, B","say ""hi""","one\ntwo"');
  });

  it('renders null and undefined as empty cells', () => {
    const csv = toCsv(
      [{ a: null, b: undefined }],
      [
        { header: 'A', value: (row) => row.a },
        { header: 'B', value: (row) => row.b },
      ]
    );
    expect(csv).toBe('A,B\r\n,');
  });
});

describe('safeFilename', () => {
  it('removes characters that are unsafe in download names', () => {
    expect(safeFilename('Class performance: Form 2/2026*')).toBe('Class-performance-Form-2-2026');
  });

  it('falls back when nothing usable remains', () => {
    expect(safeFilename('///')).toBe('tusome-analytics');
    expect(safeFilename('', 'export.csv')).toBe('export.csv');
  });

  it('keeps dots and dashes for timestamps', () => {
    expect(safeFilename('class-performance-2026-10-28-12-00-00.csv')).toBe(
      'class-performance-2026-10-28-12-00-00.csv'
    );
  });
});

describe('timestampSlug', () => {
  it('produces a filesystem-safe UTC timestamp', () => {
    expect(timestampSlug(new Date('2026-10-28T12:34:56Z'))).toBe('2026-10-28-12-34-56');
  });
});
