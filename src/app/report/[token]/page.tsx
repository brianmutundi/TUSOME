'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SharedReport {
  student: { id: string; admission_no: string; name: string; class: string | null; stream: string | null; academic_year: number | null; gender: string | null };
  school: { name: string };
  exam: { id: string; name: string; term: string; year: number; assessment_component: string };
  subjects: { subject_id: string; subject_name: string; subject_code: string; score: number; percentage: number; grade: string | null }[];
  overall: { mean: number | null; mean_percentage: number | null; total_score: number | null; subjects_count: number };
}

export default function SharedReportPage({ params }: { params: { token: string } }) {
  const [report, setReport] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_shared_report', { p_token: params.token });
        if (rpcError) {
          setError(rpcError.message);
        } else {
          setReport(data as SharedReport);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load report.');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.token]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-gray-500">Loading report…</p>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? 'Report not found or link expired.'}
        </div>
      </main>
    );
  }

  const { student, school, exam, subjects, overall } = report;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-4 flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Download / Print PDF
        </button>
      </div>

      <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="border-b border-gray-200 pb-5 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-gray-600">Student report card</p>
          <p className="mt-2 text-sm text-gray-700">
            {exam.name} · {exam.term} · {exam.year}
          </p>
        </header>

        <section className="mt-6">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex gap-2"><dt className="w-32 shrink-0 font-semibold text-gray-700">Student name</dt><dd className="text-gray-900">{student.name}</dd></div>
            <div className="flex gap-2"><dt className="w-32 shrink-0 font-semibold text-gray-700">Admission no</dt><dd className="font-mono text-gray-900">{student.admission_no}</dd></div>
            <div className="flex gap-2"><dt className="w-32 shrink-0 font-semibold text-gray-700">Class</dt><dd className="text-gray-900">{[student.class, student.stream].filter(Boolean).join(' ') || '—'}</dd></div>
            <div className="flex gap-2"><dt className="w-32 shrink-0 font-semibold text-gray-700">Gender</dt><dd className="text-gray-900">{student.gender ?? '—'}</dd></div>
          </dl>
        </section>

        <section className="mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Grade</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.subject_id} className="border-b border-gray-100">
                  <td className="px-3 py-2">{s.subject_name}</td>
                  <td className="px-3 py-2">{s.score}</td>
                  <td className="px-3 py-2">{s.grade ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm font-semibold text-gray-900">
            Average: {overall.mean_percentage != null ? overall.mean_percentage.toFixed(1) : '—'}%
          </p>
        </section>
      </article>
    </main>
  );
}