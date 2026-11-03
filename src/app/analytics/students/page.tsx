'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingPanel, SelectField, TextField } from '@/components/ui';
import {
  describeAnalyticsError,
  getAnalyticsFilters,
  getStudentDirectory,
  isAbortError,
} from '@/lib/analytics/api';
import type { AnalyticsFilterOptions } from '@/lib/analytics/api';
import type { ClassOption, StreamOption, StudentDirectoryRow } from '@/lib/analytics/types';

const EMPTY_OPTIONS: AnalyticsFilterOptions = {
  exams: [],
  classes: [],
  streams: [],
};

export default function StudentDirectoryPage() {
  const [options, setOptions] = useState<AnalyticsFilterOptions>(EMPTY_OPTIONS);
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [streamFilter, setStreamFilter] = useState('all');

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getAnalyticsFilters({ signal: controller.signal }),
      getStudentDirectory(
        query || undefined,
        classFilter !== 'all' ? classFilter : undefined,
        streamFilter !== 'all' ? streamFilter : undefined,
        100,
        { signal: controller.signal }
      ),
    ])
      .then(([filterOpts, studentRows]) => {
        if (!active) return;
        setOptions(filterOpts);
        setStudents(studentRows);
      })
      .catch((caught) => {
        if (!active || isAbortError(caught)) return;
        console.error('[analytics] failed to load student directory');
        setError(describeAnalyticsError(caught, 'Could not load student directory.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken, query, classFilter, streamFilter]);

  const refresh = useCallback(() => {
    setReloadToken((v) => v + 1);
  }, []);

  const streamsForClass = useMemo(() => {
    if (classFilter === 'all') return options.streams;
    return options.streams.filter((s) => s.class_id === classFilter);
  }, [options.streams, classFilter]);

  const filteredStudents = useMemo(() => {
    if (!query.trim()) return students;
    const q = query.trim().toLowerCase();
    return students.filter(
      (s) =>
        (s.full_name ?? '').toLowerCase().includes(q) ||
        s.admission_no.toLowerCase().includes(q)
    );
  }, [students, query]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            <Link href="/analytics" className="text-blue-700 hover:underline">
              Analytics
            </Link>{' '}
            / Student Directory
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            Student Directory
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Search and browse students in your school. Open a student to view their profile,
            enrollment history, and exam analytics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/analytics/students/new"
            className="inline-flex min-h-[2.75rem] items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Add student
          </Link>
          <Link
            href="/analytics/students/import"
            className="inline-flex min-h-[2.75rem] items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Bulk import CSV
          </Link>
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Alert tone="error" title="Could not load students">
            {error}
          </Alert>
        </div>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <TextField
            id="student-search"
            label="Search"
            type="search"
            placeholder="Search by name or admission number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <SelectField
            id="student-class-filter"
            label="Class"
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setStreamFilter('all');
            }}
          >
            <option value="all">All classes</option>
            {options.classes.map((c: ClassOption) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="student-stream-filter"
            label="Stream"
            value={streamFilter}
            onChange={(e) => setStreamFilter(e.target.value)}
          >
            <option value="all">All streams</option>
            {streamsForClass.map((s: StreamOption) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
        </div>
      </Card>

      {loading ? (
        <LoadingPanel label="Loading student directory…" />
      ) : filteredStudents.length === 0 ? (
        <Card>
          <EmptyState
            title="No students found"
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
          title="Students"
          />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Admission No
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Gender
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Class / Stream
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Pathway
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredStudents.map((s) => (
                  <tr key={s.student_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                      {s.admission_no}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {s.full_name || 'Unnamed student'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{s.gender || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {[s.class_name, s.stream_name].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{s.pathway_name || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-2 text-xs">
                        <Link
                          href={`/analytics/students/${encodeURIComponent(s.student_id)}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          Profile
                        </Link>
                        <Link
                          href={`/analytics/student/${encodeURIComponent(s.student_id)}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          Analytics
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </main>
  );
}
