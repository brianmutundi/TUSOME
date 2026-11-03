'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField } from '@/components/ui';
import { createStudent, getClassesWithStreams, isAbortError } from '@/lib/analytics/api';
import type { ClassWithStreams } from '@/lib/analytics/types';
import { validateNewStudent } from '@/lib/analytics/studentForms';

const TEMPLATE_HEADERS = [
  'admissionNo',
  'fullName',
  'gender',
  'className',
  'streamName',
  'academicYear',
  'dateOfBirth',
  'guardianName',
  'guardianRelation',
  'primaryPhone',
  'previousSchool',
];

function downloadTemplate() {
  const example = [
    'ADM-001',
    'Jane Doe',
    'Female',
    'Grade 1',
    'A',
    String(new Date().getFullYear()),
    '2015-06-15',
    'John Doe',
    'Father',
    '0712345678',
    'Previous School',
  ];
  const csv = '\uFEFF' + [TEMPLATE_HEADERS.join(','), example.join(',')].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'student-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

interface RowData {
  admissionNo: string;
  fullName: string;
  gender: string;
  className: string;
  streamName: string;
  academicYear: string;
  dateOfBirth: string;
  guardianName: string;
  guardianRelation: string;
  primaryPhone: string;
  previousSchool: string;
}

interface ParsedRow {
  rowNumber: number;
  data: RowData;
  errors: string[];
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { current.push(field.trim()); field = ''; }
      else if (ch === '\n') { current.push(field.trim()); rows.push(current); current = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
    i++;
  }
  if (field !== '' || current.length > 0) { current.push(field.trim()); rows.push(current); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

export default function StudentImportPage() {
  const [classes, setClasses] = useState<ClassWithStreams[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    import('@/lib/analytics/api').then(({ getClassesWithStreams }) => {
      getClassesWithStreams({ signal: controller.signal })
        .then((data) => { if (active) setClasses(data); })
        .catch((caught) => { if (!active) return; setLoadError('Could not load classes.'); })
        .finally(() => { if (active) setLoading(false); });
    });
    return () => { active = false; controller.abort(); };
  }, []);

  const classMap = useMemo(() => {
    const m = new Map<string, { classId: string; streamId: string | null }>();
    for (const r of classes) {
      if (r.class_name && r.stream_name) {
        m.set(r.class_name.toLowerCase() + '|' + r.stream_name.toLowerCase(), { classId: r.class_id, streamId: r.stream_id });
      }
      if (r.class_name && !m.has(r.class_name.toLowerCase() + '|')) {
        m.set(r.class_name.toLowerCase() + '|', { classId: r.class_id, streamId: null });
      }
    }
    return m;
  }, [classes]);

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Only .csv files are allowed.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('File must be under 2 MB.'); return; }
    setFileName(file.name);
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const raw = parseCsv(text);
      if (raw.length === 0) { setError('Empty file.'); return; }
      const header = raw[0].map((h) => h.trim());
      for (const h of TEMPLATE_HEADERS) {
        if (!header.includes(h)) { setError(`Missing required column: ${h}`); return; }
      }
      const rows: ParsedRow[] = [];
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i];
        if (r.every((c) => c === '')) continue;
        const data: RowData = {
          admissionNo: r[header.indexOf('admissionNo')] ?? '',
          fullName: r[header.indexOf('fullName')] ?? '',
          gender: r[header.indexOf('gender')] ?? '',
          className: r[header.indexOf('className')] ?? '',
          streamName: r[header.indexOf('streamName')] ?? '',
          academicYear: r[header.indexOf('academicYear')] ?? '',
          dateOfBirth: r[header.indexOf('dateOfBirth')] ?? '',
          guardianName: r[header.indexOf('guardianName')] ?? '',
          guardianRelation: r[header.indexOf('guardianRelation')] ?? '',
          primaryPhone: r[header.indexOf('primaryPhone')] ?? '',
          previousSchool: r[header.indexOf('previousSchool')] ?? '',
        };
        const errors: string[] = [];
        // normalize phone numbers (accept +254, 07xx, 01xx -> +254...)
        if (data.primaryPhone) {
          let p = data.primaryPhone.trim().replace(/\s+/g, '');
          if (p.startsWith('0')) p = '+254' + p.slice(1);
          else if (p.startsWith('254')) p = '+' + p;
          data.primaryPhone = p;
        }
        const v = validateNewStudent({ admissionNo: data.admissionNo, fullName: data.fullName, gender: data.gender, academicYear: data.academicYear, dateOfBirth: data.dateOfBirth, primaryPhone: data.primaryPhone });
        for (const [k, msg] of Object.entries(v)) errors.push(`${k}: ${msg}`);
        if (data.className && !classMap.has(data.className.toLowerCase() + '|') && !classMap.has(data.className.toLowerCase() + '|' + (data.streamName || '').toLowerCase())) {
          errors.push(`className: Unknown class "${data.className}"`);
        }
        rows.push({ rowNumber: i + 1, data, errors });
      }
      if (rows.length > 500) { setError('Row cap is 500. Please split the file.'); return; }
      setParsed(rows);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const validRows = parsed.filter((r) => r.errors.length === 0);
  const errorRows = parsed.filter((r) => r.errors.length > 0);

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    if (validRows.length === 0) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const payload = validRows.map((r) => {
        const key = r.data.className.toLowerCase() + '|' + (r.data.streamName || '').toLowerCase();
        const alt = r.data.className.toLowerCase() + '|';
        const info = classMap.get(key) ?? classMap.get(alt);
        return {
          admission_no: r.data.admissionNo.trim(),
          full_name: r.data.fullName.trim(),
          gender: r.data.gender || null,
          class_id: info?.classId || null,
          stream_id: info?.streamId || null,
          academic_year: r.data.academicYear ? Number(r.data.academicYear) : null,
          date_of_birth: r.data.dateOfBirth || null,
          guardian_name: r.data.guardianName.trim() || null,
          guardian_relation: r.data.guardianRelation.trim() || null,
          primary_phone: r.data.primaryPhone.trim() || null,
          previous_school: r.data.previousSchool.trim() || null,
        };
      });
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data, error: rpcError } = await supabase.rpc('bulk_create_students', { p_students: payload });
      if (rpcError) throw new Error(rpcError.message);
      const count = (data as { count?: number })?.count ?? payload.length;
      setResult(`Imported ${count} student(s) successfully.`);
      setParsed([]);
      setFileName('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading classes…" />;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        <Link href="/analytics/students" className="text-blue-700 hover:underline">Students</Link> / Import
      </p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Bulk Student Import</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">Download the template, fill it in, upload and review, then confirm.</p>

      {loadError && <Alert tone="error" title="Could not load classes">{loadError}</Alert>}
      {error && <Alert tone="error" title="Import error">{error}</Alert>}
      {result && <Alert tone="success" title="Import complete">{result}</Alert>}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={downloadTemplate}>Download CSV template</Button>
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Upload CSV
          <input
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {fileName && (
        <p className="mt-2 text-sm text-gray-600">File: {fileName} — {parsed.length} rows ({validRows.length} valid, {errorRows.length} with errors)</p>
      )}

      {parsed.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Preview" />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Adm No.</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {parsed.map((r) => (
                  <tr key={r.rowNumber} className={r.errors.length ? 'bg-red-50' : ''}>
                    <td className="px-3 py-2">{r.rowNumber}</td>
                    <td className="px-3 py-2">{r.data.admissionNo}</td>
                    <td className="px-3 py-2">{r.data.fullName}</td>
                    <td className="px-3 py-2">{r.data.className}</td>
                    <td className="px-3 py-2 text-xs text-red-700">{r.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end p-4">
            <Button onClick={handleConfirm} disabled={importing || validRows.length === 0}>
              {importing ? 'Importing…' : `Import ${validRows.length} valid row(s)`}
            </Button>
          </div>
        </Card>
      )}
    </main>
  );
}