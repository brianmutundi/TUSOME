import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@/lib/supabase/client';
import { AnalyticsContractError } from './guards';
import {
  describeAnalyticsError,
  getAccountDirectory,
  getAnalyticsFilters,
  getClassPerformance,
  getMarkSheet,
  getMostImproved,
  getStudentExamHistory,
  isAbortError,
} from './api';

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

function useRpc(data: unknown, error: unknown = null) {
  const abortSignal = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn().mockReturnValue({ abortSignal });
  mockedCreateClient.mockReturnValue({ rpc } as unknown as ReturnType<typeof createClient>);
  return { rpc, abortSignal };
}

const validRow = {
  student_id: 'a5000000-0000-0000-0000-000000000001',
  admission_no: 'A-001',
  student_name: 'Alice A',
  stream_name: 'Blue',
  total_score: 116,
  mean_score: 58,
  mean_percentage: 58,
  overall_grade: 'AE',
  overall_points: 2,
  class_position: 2,
  subjects_count: 2,
  passed_count: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getClassPerformance', () => {
  it('calls the RPC with nulls for empty filters and validates the response', async () => {
    const { rpc, abortSignal } = useRpc([validRow]);
    const controller = new AbortController();

    const result = await getClassPerformance('exam-1', '', '', { signal: controller.signal });

    expect(rpc).toHaveBeenCalledWith('get_class_performance', {
      p_exam_id: 'exam-1',
      p_class_id: null,
      p_stream_id: null,
    });
    expect(abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(result).toEqual([validRow]);
  });

  it('passes class and stream filters through', async () => {
    const { rpc } = useRpc([]);
    await getClassPerformance('exam-1', 'class-1', 'stream-1');
    expect(rpc).toHaveBeenCalledWith('get_class_performance', {
      p_exam_id: 'exam-1',
      p_class_id: 'class-1',
      p_stream_id: 'stream-1',
    });
  });

  it('surfaces RPC errors instead of rendering an empty dashboard', async () => {
    useRpc(null, { code: 'SERVER_ERROR', message: 'Exam is not published' });
    await expect(getClassPerformance('exam-1')).rejects.toMatchObject({
      code: 'SERVER_ERROR',
    });
  });

  it('throws a contract error when the payload is malformed', async () => {
    useRpc([{ ...validRow, total_score: 'not-a-number' }]);
    await expect(getClassPerformance('exam-1')).rejects.toBeInstanceOf(AnalyticsContractError);
  });

  it('rejects with an AbortError after the request finishes if the signal aborted', async () => {
    useRpc([validRow]);
    const controller = new AbortController();
    controller.abort();
    await expect(getClassPerformance('exam-1', '', '', { signal: controller.signal })).rejects.toMatchObject(
      { name: 'AbortError' }
    );
  });
});

describe('getMarkSheet', () => {
  const row = {
    student_id: 'a5000000-0000-0000-0000-000000000001',
    admission_no: 'A-001',
    student_name: 'Alice A',
    class_name: 'Class A1',
    stream_name: 'Blue',
    subject_id: 'a3000000-0000-0000-0000-000000000001',
    subject_name: 'Mathematics',
    subject_code: 'MAT',
    score: 85,
    grade_code: 'A1',
    grade_name: 'A1',
    points: 8,
  };

  it('passes the exam and optional filters and normalises the matrix', async () => {
    const { rpc } = useRpc([row]);
    const result = await getMarkSheet('exam-1', 'class-1', 'stream-1');
    expect(rpc).toHaveBeenCalledWith('get_mark_sheet', {
      p_exam_id: 'exam-1',
      p_class_id: 'class-1',
      p_stream_id: 'stream-1',
    });
    expect(result[0]).toMatchObject({ score: 85, grade_code: 'A1' });
  });

  it('sends nulls when filters are omitted', async () => {
    const { rpc } = useRpc([]);
    await getMarkSheet('exam-1');
    expect(rpc).toHaveBeenCalledWith('get_mark_sheet', {
      p_exam_id: 'exam-1',
      p_class_id: null,
      p_stream_id: null,
    });
  });

  it('throws a contract error for a malformed row', async () => {
    useRpc([{ ...row, score: 'n/a' }]);
    await expect(getMarkSheet('exam-1')).rejects.toBeInstanceOf(AnalyticsContractError);
  });
});

describe('getStudentExamHistory', () => {
  const row = {
    exam_id: 'e1',
    exam_name: 'Mid Term',
    term: 'Term 1',
    academic_year: 2026,
    assessment_component: 'end_term',
    total_score: 400,
    mean_score: 66.67,
    subjects_count: 6,
    overall_grade: 'B',
    overall_points: 5,
    position: 3,
    total_in_exam: 40,
  };

  it('calls the RPC with the student id and normalises rows', async () => {
    const { rpc } = useRpc([row]);
    const result = await getStudentExamHistory('student-1');
    expect(rpc).toHaveBeenCalledWith('get_student_exam_history', { p_student_id: 'student-1' });
    expect(result[0]).toMatchObject({ exam_id: 'e1', position: 3 });
  });

  it('accepts numeric strings for bigint columns', async () => {
    useRpc([{ ...row, position: '3', total_in_exam: '40' }]);
    const [parsed] = await getStudentExamHistory('student-1');
    expect(parsed.position).toBe(3);
    expect(parsed.total_in_exam).toBe(40);
  });
});

describe('getMostImproved', () => {
  const row = {
    student_id: 'a5000000-0000-0000-0000-000000000001',
    admission_no: 'A-001',
    student_name: 'Alice A',
    stream_name: 'Blue',
    current_mean: 72,
    previous_mean: 55,
    delta: 17,
    previous_exam_name: 'Mid Term',
  };

  it('passes class and stream filters through', async () => {
    const { rpc } = useRpc([row]);
    const result = await getMostImproved('exam-1', 'class-1', 'stream-1');
    expect(rpc).toHaveBeenCalledWith('get_most_improved', {
      p_exam_id: 'exam-1',
      p_class_id: 'class-1',
      p_stream_id: 'stream-1',
    });
    expect(result[0]).toMatchObject({ delta: 17 });
  });

  it('sends nulls when no filters are given', () => {
    const { rpc } = useRpc([]);
    return getMostImproved('exam-1').then(() => {
      expect(rpc).toHaveBeenCalledWith('get_most_improved', {
        p_exam_id: 'exam-1',
        p_class_id: null,
        p_stream_id: null,
      });
    });
  });
});

describe('getAccountDirectory', () => {
  const row = {
    account_id: 'a0000000-0000-0000-0000-0000000000f1',
    full_name: 'Alice Admin',
    email: 'alice@school.local',
    role: 'admin',
    staff_type: 'OFFICIAL',
    is_active: true,
    access_revoked: false,
    granted_overrides: 0,
    denied_overrides: 0,
    created_at: '2026-01-15T08:00:00Z',
  };

  it('calls get_account_directory with the abort signal and normalises rows', async () => {
    const { rpc, abortSignal } = useRpc([row]);
    const controller = new AbortController();
    const result = await getAccountDirectory({ signal: controller.signal });
    expect(rpc).toHaveBeenCalledWith('get_account_directory');
    expect(abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(result).toEqual([row]);
  });

  it('surfaces RPC errors and contract errors', async () => {
    useRpc(null, { code: 'P0001', message: 'Missing tenant claim' });
    await expect(getAccountDirectory()).rejects.toMatchObject({ code: 'MISSING_TENANT' });

    useRpc([{ ...row, is_active: 1 }]);
    await expect(getAccountDirectory()).rejects.toBeInstanceOf(AnalyticsContractError);
  });
});

describe('getAnalyticsFilters', () => {  const filters = {
    exams: [
      {
        id: 'e1',
        name: 'Exam',
        term: 'Term 1',
        academic_year: 2026,
        assessment_component: null,
        status: 'published',
        published_at: null,
      },
    ],
    classes: [{ id: 'c1', name: 'Grade 7' }],
    streams: [{ id: 's1', class_id: 'c1', name: 'Blue' }],
  };

  it('loads every filter list from the tenant-scoped RPC in one call', async () => {
    const { rpc, abortSignal } = useRpc(filters);
    const controller = new AbortController();

    const result = await getAnalyticsFilters({ signal: controller.signal });

    expect(rpc).toHaveBeenCalledWith('get_analytics_filters');
    expect(abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(result.exams).toHaveLength(1);
    expect(result.classes).toEqual([{ id: 'c1', name: 'Grade 7' }]);
    expect(result.streams).toEqual([{ id: 's1', class_id: 'c1', name: 'Blue' }]);
  });

  it('normalises missing lists to empty arrays', async () => {
    useRpc({ exams: [], classes: [], streams: [] });
    await expect(getAnalyticsFilters()).resolves.toEqual({ exams: [], classes: [], streams: [] });
  });

  it('surfaces RPC errors instead of silently emptying the dropdowns', async () => {
    useRpc(null, { code: 'P0001', message: 'Missing tenant claim' });
    await expect(getAnalyticsFilters()).rejects.toMatchObject({ code: 'MISSING_TENANT' });
  });

  it('throws a contract error when the payload is not an object', async () => {
    useRpc([{ id: 'e1' }]);
    await expect(getAnalyticsFilters()).rejects.toBeInstanceOf(AnalyticsContractError);
  });

  it('throws a contract error when a nested list is malformed', async () => {
    useRpc({ exams: [{ id: 'e1' }], classes: [], streams: [] });
    await expect(getAnalyticsFilters()).rejects.toBeInstanceOf(AnalyticsContractError);
  });
});

describe('describeAnalyticsError', () => {
  it('shows safe SQL exceptions raised by the analytics functions', () => {
    expect(describeAnalyticsError({ code: 'P0001', message: 'Access denied' })).toBe('Access denied');
  });

  it('maps permission and session failures', () => {
    expect(describeAnalyticsError({ code: '42501', message: 'permission denied' })).toContain(
      'do not have permission'
    );
    expect(describeAnalyticsError({ code: 'PGRST301', message: 'jwt expired' })).toContain(
      'session has expired'
    );
  });

  it('shows contract errors because they contain no row data', () => {
    expect(describeAnalyticsError(new AnalyticsContractError('summary'))).toContain(
      'unexpected response'
    );
  });

  it('hides unexpected internals and logs them', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(describeAnalyticsError(new Error('connection string leaked'))).toBe(
      'Something went wrong. Please try again.'
    );
    expect(log).toHaveBeenCalled();
  });

  it('uses the supplied fallback for a null error', () => {
    expect(describeAnalyticsError(null, 'Custom fallback')).toBe('Custom fallback');
  });
});

describe('isAbortError', () => {
  it('recognises DOMException and plain-shaped abort errors', () => {
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true);
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError(new Error('other'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
