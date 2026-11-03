'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField } from '@/components/ui';
import {
  getAnalyticsFilters,
  getClassesWithStreams,
  getSubjectsWithDetails,
  getExamMarkEntryRoster,
  saveExamSubjectMarks,
  isAbortError,
} from '@/lib/analytics/api';
import type { ClassWithStreams, SubjectWithDetails } from '@/lib/analytics/types';

const MAX_MARK = 100;

function downloadTemplate(students: { admission_no: string; full_name: string }[], subjects: string[]) {
  const header = ['admissionNo', 'studentName', ...subjects];
  const rows = students.map((s) => [s.admission_no, s.full_name, ...subjects.map(() => '')]);
  const csv = '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'marks-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
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

export default function MarksImportPage() {
  const [exams, setExams] = useState<{ id: string; name: string; term: string | null; academic_year: number | null }[]>([]);
  const [classes, setClasses] = useState<ClassWithStreams[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [examId, setExamId] = useState('');
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const [roster, setRoster] = useState<{ student_id: string; admission_no: string; full_name: string; score: number | null }[]>([]);
  const [templateReady, setTemplateReady] = useState(false);

  const [parsed, setParsed] = useState<{ rowNumber: number; admissionNo: string; name: string; scores: Record<string, string>; errors: string[]; studentId: string | null }[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getAnalyticsFilters({ signal: controller.signal }),
      getClassesWithStreams({ signal: controller.signal }),
      getSubjectsWithDetails({ signal: controller.signal }),
    ])
      .then(([f, c, s]) => {
        if (!active) return;
        setExams((f.exams ?? []).map((e: any) => ({ id: e.id, name: e.name, term: e.term, academic_year: e.academic_year })));
        if (f.exams?.length) setExamId(f.exams[0].id);
        setClasses(c);
        setSubjects(s);
        if (s.length) setSubjectId(s[0].subject_id);
      })
      .catch(() => { if (active) setLoadError('Could not load data.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  const streams = useMemo(() => {
    return classes.filter((r) => r.class_id === classId && r.stream_id).map((r) => ({ id: r.stream_id as string, name: r.stream_name ?? 'Stream' }));
  }, [classes, classId]);

  const selectedSubjects = useMemo(() => {
    if (subjectId) return subjects.filter((s) => s.subject_id === subjectId);
    return subjects;
  }, [subjects, subjectId]);

  const loadRoster = useCallback(async () => {
    if (!examId || !classId) return;
    try {
      const data = await getExamMarkEntryRoster(examId, classId, streamId || undefined, subjectId || undefined);
      setRoster(data.map((r: any) => ({ student_id: r.student_id, admission_no: r.admission_no, full_name: r.full_name, score: r.score })));
      setTemplateReady(true);
    } catch (e) {
      setError('Could not load roster.');
    }
  }, [examId, classId, streamId, subjectId]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  const handleDownload = () => {
    const students = roster.map((r) => ({ admission_no: r.admission_no, full_name: r.full_name }));
    const subs = selectedSubjects.map((s) => s.subject_name);
    downloadTemplate(students, subs.length ? subs : ['Marks']);
  };

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
      if (!header.includes('admissionNo')) { setError('Missing required column: admissionNo'); return; }
      const subjectCols = header.filter((h) => h !== 'admissionNo' && h !== 'studentName');
      const rows = [];
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i];
        if (r.every((c) => c === '')) continue;
        const admissionNo = r[header.indexOf('admissionNo')] ?? '';
        const name = r[header.indexOf('studentName')] ?? '';
        const scores: Record<string, string> = {};
        const errors: string[] = [];
        for (const col of subjectCols) {
          const val = (r[header.indexOf(col)] ?? '').trim();
          scores[col] = val;
          if (val === '' || val.toUpperCase() === 'ABS') continue;
          const num = Number(val);
          if (isNaN(num)) { errors.push(`${col}: must be numeric or ABS`); continue; }
          if (num < 0 || num > MAX_MARK) errors.push(`${col}: must be 0-${MAX_MARK}`);
        }
        // match student
        const matched = roster.find((st) => st.admission_no === admissionNo);
        if (!matched) errors.push('admissionNo: unknown or not enrolled');
        rows.push({ rowNumber: i + 1, admissionNo, name, scores, errors, studentId: matched?.student_id ?? null });
      }
      setParsed(rows);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const validRows = parsed.filter((r) => r.errors.length === 0);

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    if (validRows.length === 0 || !examId || !subjectId) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      // Group by subject and save
      const entries = validRows.map((r) => ({
        student_id: r.studentId as string,
        score: r.scores[selectedSubjects[0]?.subject_name] === '' || r.scores[selectedSubjects[0]?.subject_name]?.toUpperCase() === 'ABS'
          ? null
          : Number(r.scores[selectedSubjects[0]?.subject_name]),
      }));
      await saveExamSubjectMarks(examId, subjectId, entries);
      setResult(`Imported ${entries.length} mark(s) successfully.`);
      setParsed([]);
      setFileName('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading…" />;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        <Link href="/analytics/exams" className="text-blue-700 hover:underline">Exams</Link> / Marks Import
      </p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Bulk Marks Import</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">Select context, download template, enter marks, upload and review.</p>

      {loadError && <Alert tone="error" title="Could not load data">{loadError}</Alert>}
      {error && <Alert tone="error" title="Import error">{error}</Alert>}
      {result && <Alert tone="success" title="Import complete">{result}</Alert>}

      {/* Context selectors */}
      <Card className="mt-6">
        <CardHeader title="1. Select context" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField id="ctx-exam" label="Exam" value={examId} onChange={(e) => setExamId(e.target.value)}>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.term} · {e.academic_year}</option>)}
          </SelectField>
          <SelectField id="ctx-class" label="Class" value={classId} onChange={(e) => { setClassId(e.target.value); setStreamId(''); }}>
            <option value="">Choose class</option>
            {Array.from(new Map(classes.map((c) => [c.class_id, c.class_name])).entries()).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </SelectField>
          <SelectField id="ctx-stream" label="Stream" value={streamId} onChange={(e) => setStreamId(e.target.value)}>
            <option value="">All streams</option>
            {streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
          <SelectField id="ctx-subject" label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((s) => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>)}
          </SelectField>
        </div>
        <div className="flex justify-end p-5 pt-0">
          <Button onClick={handleDownload} disabled={!examId || !classId || roster.length === 0}>
            Download CSV template
          </Button>
        </div>
      </Card>

      {/* Upload */}
      <div className="mt-6 flex flex-wrap gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Upload CSV
          <input type="file" accept=".csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        </label>
      </div>
      {fileName && <p className="mt-2 text-sm text-gray-600">File: {fileName} — {parsed.length} rows ({validRows.length} valid)</p>}

      {/* Preview */}
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
                  {selectedSubjects.map((s) => <th key={s.subject_id} className="px-3 py-2">{s.subject_name}</th>)}
                  <th className="px-3 py-2">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {parsed.map((r) => (
                  <tr key={r.rowNumber} className={r.errors.length ? 'bg-red-50' : ''}>
                    <td className="px-3 py-2">{r.rowNumber}</td>
                    <td className="px-3 py-2">{r.admissionNo}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    {selectedSubjects.map((s) => <td key={s.subject_id} className="px-3 py-2">{r.scores[s.subject_name] ?? ''}</td>)}
                    <td className="px-3 py-2 text-xs text-red-700">{r.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end p-4">
            <Button onClick={handleConfirm} disabled={importing || validRows.length === 0 || !subjectId}>
              {importing ? 'Importing…' : `Import ${validRows.length} row(s)`}
            </Button>
          </div>
        </Card>
      )}
    </main>
  );
}