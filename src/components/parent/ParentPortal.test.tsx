import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

const api = vi.hoisted(() => ({
  getMyChildren: vi.fn(),
  getMyNotices: vi.fn(),
  markNoticesRead: vi.fn(),
  getEvents: vi.fn(),
  getMyChildFees: vi.fn(),
  getMyChildAttendance: vi.fn(),
  getMyChildReceipts: vi.fn(),
  getMyChildPayments: vi.fn(),
  getMyChildResults: vi.fn(),
  getMyChildTimetable: vi.fn(),
  getMyChildPaybill: vi.fn(),
  getMyChildHomework: vi.fn(),
  setMyChildHomeworkDone: vi.fn(),
  createMyChildReceiptToken: vi.fn(),
  createMyChildStatementToken: vi.fn(),
  createMyChildReportToken: vi.fn(),
  setMyPhone: vi.fn(),
  getMyPhone: vi.fn(),
  getMyThreads: vi.fn(),
  getMyMessageOptions: vi.fn(),
  getMyThreadMessages: vi.fn(),
  createMyThread: vi.fn(),
  sendMyThreadMessage: vi.fn(),
  reopenMyThread: vi.fn(),
  markMyThreadRead: vi.fn(),
  getMyPreferences: vi.fn(),
  setMyPreferences: vi.fn(),
}));
const nav = vi.hoisted(() => ({ params: {} as Record<string, string>, push: vi.fn() }));

vi.mock('@/lib/analytics/api', () => ({
  ...api,
  isAbortError: () => false,
  describeAnalyticsError: (_e: unknown, fallback: string) => fallback,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/parent',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: nav.push }),
  useParams: () => nav.params,
}));

import { ParentProvider } from './ParentContext';
import ParentHomePage from '@/app/parent/page';
import FeesPage from '@/app/parent/fees/page';
import AlertsPage from '@/app/parent/alerts/page';
import ResultsPage from '@/app/parent/results/page';
import ProfilePage from '@/app/parent/profile/page';
import TimetablePage from '@/app/parent/timetable/page';
import HomeworkPage from '@/app/parent/homework/page';
import MessagesPage from '@/app/parent/messages/page';
import ThreadPage from '@/app/parent/messages/[threadId]/page';
import MorePage from '@/app/parent/more/page';
import { BottomNav } from './parts';
import { AnalyticsAPIError } from '@/lib/analytics/errors';

const amina = { studentId: 'a', fullName: 'Amina Otieno', admissionNo: '5A', className: 'Grade 5', relationship: 'mother', isPrimary: true, classId: 'c5', streamId: null, streamName: null };
const brian = { studentId: 'b', fullName: 'Brian Otieno', admissionNo: '2B', className: 'Grade 2', relationship: 'mother', isPrimary: false, classId: 'c2', streamId: null, streamName: null };

const wrap = (ui: ReactNode) => render(<ParentProvider email="p@x.test" onSignOut={vi.fn()}>{ui}</ParentProvider>);

const notice = (id: string, o: Record<string, unknown> = {}) => ({
  noticeId: id, title: `Notice ${id}`, content: 'Body', noticeType: 'general',
  publishedAt: '2026-11-01T08:00:00Z', expiresAt: null, createdAt: '2026-11-01T08:00:00Z', isRead: false, ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  nav.params = {};
  window.localStorage.clear();
  api.getMyChildren.mockResolvedValue([amina, brian]);
  api.getMyNotices.mockResolvedValue([]);
  api.markNoticesRead.mockResolvedValue(undefined);
  api.getEvents.mockResolvedValue([]);
  api.getMyChildFees.mockImplementation(async (id: string) => [
    { voteHeadId: 'v', voteHeadName: 'Tuition', charged: 4000, paid: id === 'a' ? 2500 : 4000, waived: 0, balance: id === 'a' ? 1500 : 0 },
  ]);
  api.getMyChildAttendance.mockResolvedValue([{ status: 'present', days: 41 }]);
  api.getMyChildReceipts.mockResolvedValue([
    { receipt_id: 'r1', receipt_number: 'RCP-1', amount_paid: 1000, payment_method: 'Cash', reference_number: null, paid_at: '2026-11-04T08:00:00Z', paid_by: null },
  ]);
  api.getMyChildPayments.mockResolvedValue([]);
  api.getMyChildPaybill.mockImplementation(async (id: string) => ({ paybillNumber: '522522', accountNumber: id === 'a' ? '5A' : '2B', schoolName: 'Test School' }));
  api.getMyChildResults.mockResolvedValue([]);
  api.getMyChildTimetable.mockResolvedValue([]);
  api.getMyChildHomework.mockResolvedValue([]);
  api.setMyChildHomeworkDone.mockResolvedValue(undefined);
  api.getMyThreads.mockResolvedValue([]);
  api.getMyMessageOptions.mockResolvedValue([
    { studentId: 'a', canMessageSchool: true, classTeacherName: 'Ms Wanjiku' },
    { studentId: 'b', canMessageSchool: true, classTeacherName: null },
  ]);
  api.getMyThreadMessages.mockResolvedValue([]);
  api.createMyThread.mockResolvedValue({ threadId: 't-new', audience: 'bursar' });
  api.sendMyThreadMessage.mockResolvedValue(undefined);
  api.reopenMyThread.mockResolvedValue(undefined);
  api.markMyThreadRead.mockResolvedValue(undefined);
  api.getMyPreferences.mockResolvedValue({
    homeworkDueTomorrow: true, eventReminders: true, replyNotifications: true,
    smsHomeworkDueTomorrow: false, smsEventReminders: false, smsReplyNotifications: false,
  });
  api.setMyPreferences.mockResolvedValue(undefined);
  api.getMyPhone.mockResolvedValue(null);
});

describe('parent home', () => {
  it('shows the selected child balance and switches children', async () => {
    const user = userEvent.setup();
    wrap(<ParentHomePage />);
    expect(await screen.findByText('KES 1,500.00')).toBeInTheDocument();
    expect(screen.getByText('Days present').previousSibling).toHaveTextContent('41');

    await user.click(screen.getByRole('button', { name: /Brian/ }));
    expect(await screen.findByText('Fees cleared')).toBeInTheDocument();
    expect(api.getMyChildFees).toHaveBeenCalledWith('b', expect.anything());
  });

  it('opens the paybill sheet with the school paybill and the child admission number', async () => {
    const user = userEvent.setup();
    wrap(<ParentHomePage />);
    await user.click(await screen.findByRole('button', { name: 'Pay with M-Pesa' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pay with M-Pesa' });
    expect(await within(dialog).findByText('522522', { selector: 'dd' })).toBeInTheDocument();
    expect(within(dialog).getByText('5A', { selector: 'dd' })).toBeInTheDocument();
    expect(api.getMyChildPaybill).toHaveBeenCalledWith('a', expect.anything());
    await user.click(within(dialog).getByRole('button', { name: 'Copy account number' }));
    expect(await within(dialog).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe('5A');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tells the parent to contact the school when no paybill is set', async () => {
    api.getMyChildPaybill.mockResolvedValue({ paybillNumber: null, accountNumber: '5A', schoolName: 'Test School' });
    const user = userEvent.setup();
    wrap(<FeesPage />);
    await user.click(await screen.findByRole('button', { name: 'Pay with M-Pesa' }));
    expect(await screen.findByText(/has not set up M-Pesa paybill details yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy account number' })).not.toBeInTheDocument();
  });

  it('shows an error with retry when payment details fail to load', async () => {
    api.getMyChildPaybill.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    wrap(<FeesPage />);
    await user.click(await screen.findByRole('button', { name: 'Pay with M-Pesa' }));
    expect(await screen.findByText('Could not load payment details.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Try again|Retry/ }));
    expect(await screen.findByText('522522', { selector: 'dd' })).toBeInTheDocument();
  });

  it('shows paid against billed with a progress bar', async () => {
    wrap(<ParentHomePage />);
    const bar = await screen.findByRole('progressbar', { name: 'Fees paid this term' });
    expect(bar).toHaveAttribute('aria-valuenow', '63');
    expect(screen.getByText('Paid KES 2,500.00')).toBeInTheDocument();
    expect(screen.getByText('Billed KES 4,000.00')).toBeInTheDocument();
  });

  it('explains when no children are linked', async () => {
    api.getMyChildren.mockResolvedValue([]);
    wrap(<ParentHomePage />);
    expect(await screen.findByText('No children linked yet')).toBeInTheDocument();
  });

  it('shows a retryable error when fees fail', async () => {
    api.getMyChildFees.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    wrap(<ParentHomePage />);
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('KES 1,500.00')).toBeInTheDocument();
  });
});

describe('parent home dashboard extras', () => {
  const hw = (id: string, o: Record<string, unknown> = {}) => ({
    assignmentId: id, subjectName: 'Maths', title: `Task ${id}`, instructions: null,
    dueDate: '2999-01-01', teacherName: null, isDone: false, doneAt: null, ...o,
  });

  it('lists open homework with overdue first and says how many more there are', async () => {
    api.getMyChildHomework.mockResolvedValue([
      hw('1'), hw('2'), hw('3'), hw('4'),
      hw('old', { dueDate: '2000-01-01' }),
      hw('ticked', { isDone: true }),
    ]);
    wrap(<ParentHomePage />);
    const section = await screen.findByRole('region', { name: 'Homework' });
    const rows = await within(section).findAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Task old');
    expect(rows[0]).toHaveTextContent('overdue');
    expect(within(section).queryByText('Task ticked')).not.toBeInTheDocument();
    expect(within(section).getByText('+2 more')).toBeInTheDocument();
  });

  it('says nothing is due when all homework is ticked or there is none', async () => {
    wrap(<ParentHomePage />);
    expect(await screen.findByText(/Nothing to do/)).toBeInTheDocument();
  });

  it('shows the newest exam average and strongest subject, and hides the card with no results', async () => {
    api.getMyChildResults.mockResolvedValue([
      { examId: 'e2', examName: 'Term 2 Exam', term: 'Term 2', academicYear: 2026, subjectName: 'English', score: 80, maxScore: 100 },
      { examId: 'e2', examName: 'Term 2 Exam', term: 'Term 2', academicYear: 2026, subjectName: 'Maths', score: 60, maxScore: 100 },
      { examId: 'e1', examName: 'Term 1 Exam', term: 'Term 1', academicYear: 2026, subjectName: 'Maths', score: 10, maxScore: 100 },
    ]);
    wrap(<ParentHomePage />);
    const section = await screen.findByRole('region', { name: 'Latest results' });
    expect(section).toHaveTextContent('Term 2 Exam');
    expect(section).toHaveTextContent('70%');
    expect(section).toHaveTextContent('Strongest: English (80)');
  });

  it('hides the results card when there are no results', async () => {
    wrap(<ParentHomePage />);
    await screen.findByText('KES 1,500.00');
    expect(screen.queryByRole('region', { name: 'Latest results' })).not.toBeInTheDocument();
  });

  it('shows a retryable error when results fail', async () => {
    api.getMyChildResults.mockRejectedValue(new Error('boom'));
    wrap(<ParentHomePage />);
    const section = await screen.findByRole('region', { name: 'Latest results' });
    expect(within(section).getByText('Could not load results.')).toBeInTheDocument();
  });

  it('badges the Homework and Messages shortcuts', async () => {
    api.getMyChildHomework.mockResolvedValue([hw('1'), hw('2')]);
    api.getMyThreads.mockResolvedValue([
      { threadId: 't1', studentId: 'a', studentName: 'Amina Otieno', audience: 'bursar', subject: 'Fees', status: 'open', closedAt: null, canReopen: false,
        lastMessageAt: '2026-11-05T08:00:00Z', lastMessagePreview: 'Hello', lastSenderKind: 'staff', isUnread: true },
    ]);
    wrap(<ParentHomePage />);
    expect(await screen.findByRole('link', { name: 'Homework, 2 to do' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Messages, 1 unread' })).toBeInTheDocument();
  });
});

describe('fees', () => {
  it('opens a receipt in the tab it opened during the click', async () => {
    const win = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
    api.createMyChildReceiptToken.mockResolvedValue('tok123');
    const user = userEvent.setup();
    wrap(<FeesPage />);
    await user.click(await screen.findByRole('button', { name: 'Open receipt RCP-1' }));
    await waitFor(() => expect(win.location.href).toBe('/receipt/tok123'));
    expect(win.opener).toBeNull();
  });

  it('closes the blank tab and reports the error when the token fails', async () => {
    const win = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
    api.createMyChildReceiptToken.mockRejectedValue(new Error('no'));
    const user = userEvent.setup();
    wrap(<FeesPage />);
    await user.click(await screen.findByRole('button', { name: 'Open receipt RCP-1' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not open receipt.');
    expect(win.close).toHaveBeenCalled();
  });
});

describe('alerts', () => {
  it('shows server-side read state and persists mark all read through the API', async () => {
    api.getMyNotices.mockResolvedValue([notice('1'), notice('2', { isRead: true })]);
    const user = userEvent.setup();
    wrap(<AlertsPage />);
    expect(await screen.findByText('Notice 1')).toBeInTheDocument();
    expect(screen.getByText('Notice 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notifications, 1 unread' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(screen.getByText('All caught up')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notifications, 0 unread' })).toBeInTheDocument();
    expect(api.markNoticesRead).toHaveBeenCalledWith(['1']);
  });

  it('does not use device storage for read state', async () => {
    api.getMyNotices.mockResolvedValue([notice('1')]);
    const user = userEvent.setup();
    wrap(<AlertsPage />);
    await user.click(await screen.findByRole('button', { name: /Notice 1/ }));
    expect(window.localStorage.getItem('tusome.parent.read:p@x.test')).toBeNull();
  });

  it('puts the notice back to unread when the save fails', async () => {
    api.getMyNotices.mockResolvedValue([notice('1')]);
    api.markNoticesRead.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    wrap(<AlertsPage />);
    await user.click(await screen.findByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Notifications, 1 unread' })).toBeInTheDocument());
  });
});

describe('results', () => {
  it('shows the newest exam first and switches exam tabs', async () => {
    api.getMyChildResults.mockResolvedValue([
      { examId: '2', examName: 'Mid Term', term: 'Term 3', academicYear: 2026, subjectName: 'Maths', score: 73, maxScore: 100 },
      { examId: '1', examName: 'Term 1', term: 'Term 1', academicYear: 2026, subjectName: 'Maths', score: 85, maxScore: 100 },
    ]);
    const user = userEvent.setup();
    wrap(<ResultsPage />);
    expect(await screen.findByRole('tab', { name: 'Mid Term', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Maths (73)')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Term 1' }));
    expect(screen.getByText('Maths (85)')).toBeInTheDocument();
  });

  it('shows the maximum when a paper is not out of 100', async () => {
    api.getMyChildResults.mockResolvedValue([
      { examId: '1', examName: 'CAT', term: 'Term 1', academicYear: 2026, subjectName: 'Science', score: 39, maxScore: 50 },
    ]);
    wrap(<ResultsPage />);
    expect(await screen.findByText('Science (39/50)')).toBeInTheDocument();
    expect(screen.getByText('78.0%')).toBeInTheDocument();
  });

  it('opens the report card for the selected exam in the tab opened during the click', async () => {
    const win = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
    api.createMyChildReportToken.mockResolvedValue('rep456');
    api.getMyChildResults.mockResolvedValue([
      { examId: '2', examName: 'Mid Term', term: 'Term 3', academicYear: 2026, subjectName: 'Maths', score: 73, maxScore: 100 },
      { examId: '1', examName: 'Term 1', term: 'Term 1', academicYear: 2026, subjectName: 'Maths', score: 85, maxScore: 100 },
    ]);
    const user = userEvent.setup();
    wrap(<ResultsPage />);
    await user.click(await screen.findByRole('tab', { name: 'Term 1' }));
    await user.click(screen.getByRole('button', { name: 'View report card' }));
    await waitFor(() => expect(win.location.href).toBe('/report/rep456'));
    expect(api.createMyChildReportToken).toHaveBeenCalledWith('a', '1');
  });

  it('closes the blank tab and shows an error when the report token fails', async () => {
    const win = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
    api.createMyChildReportToken.mockRejectedValue(new Error('no'));
    api.getMyChildResults.mockResolvedValue([
      { examId: '1', examName: 'Term 1', term: 'Term 1', academicYear: 2026, subjectName: 'Maths', score: 85, maxScore: 100 },
    ]);
    const user = userEvent.setup();
    wrap(<ResultsPage />);
    await user.click(await screen.findByRole('button', { name: 'View report card' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not open the report card.');
    expect(win.close).toHaveBeenCalled();
  });
});

describe('profile', () => {
  it('rejects a bad number without calling the server, saves a good one', async () => {
    api.setMyPhone.mockResolvedValue('+254712345678');
    const user = userEvent.setup();
    wrap(<ProfilePage />);
    await user.type(screen.getByLabelText('M-Pesa number'), '12345');
    await user.click(screen.getByRole('button', { name: 'Save number' }));
    expect(screen.getByText(/Enter a valid Kenyan number/)).toBeInTheDocument();
    expect(api.setMyPhone).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('M-Pesa number'));
    await user.type(screen.getByLabelText('M-Pesa number'), '0712 345 678');
    await user.click(screen.getByRole('button', { name: 'Save number' }));
    expect(await screen.findByText(/Saved \+254712345678/)).toBeInTheDocument();
  });
});

describe('profile phone number', () => {
  it('shows the saved number in the box', async () => {
    api.getMyPhone.mockResolvedValue('254712345678');
    wrap(<ProfilePage />);
    expect(await screen.findByDisplayValue('0712 345 678')).toBeInTheDocument();
  });

  it('leaves the box empty when no number is saved, and does not overwrite what was typed', async () => {
    let resolve: (v: string | null) => void = () => {};
    api.getMyPhone.mockReturnValue(new Promise((r) => { resolve = r; }));
    const user = userEvent.setup();
    wrap(<ProfilePage />);
    await user.type(screen.getByLabelText('M-Pesa number'), '0733');
    await act(async () => { resolve('254712345678'); });
    expect(screen.getByLabelText('M-Pesa number')).toHaveValue('0733');
  });

  it('refuses to turn SMS on until a number is saved', async () => {
    const user = userEvent.setup();
    wrap(<ProfilePage />);
    await user.click(await screen.findByRole('switch', { name: 'Events and reminders: by SMS' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Save your M-Pesa number above before turning on SMS.');
    expect(api.setMyPreferences).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Events and reminders: by SMS' })).not.toBeChecked();
  });

  it('allows SMS once the number is saved on this page', async () => {
    api.setMyPhone.mockResolvedValue('254712345678');
    const user = userEvent.setup();
    wrap(<ProfilePage />);
    await user.type(screen.getByLabelText('M-Pesa number'), '0712 345 678');
    await user.click(screen.getByRole('button', { name: 'Save number' }));
    await screen.findByText(/Saved 254712345678/);
    await user.click(await screen.findByRole('switch', { name: 'Homework due tomorrow: by SMS' }));
    expect(api.setMyPreferences).toHaveBeenCalledWith(expect.objectContaining({ smsHomeworkDueTomorrow: true }));
  });

  it('does not block in-app switches when there is no number', async () => {
    const user = userEvent.setup();
    wrap(<ProfilePage />);
    await user.click(await screen.findByRole('switch', { name: 'Events and reminders: in the app' }));
    expect(api.setMyPreferences).toHaveBeenCalledWith(expect.objectContaining({ eventReminders: false }));
  });

  it('blocks SMS when the saved number could not be checked', async () => {
    api.getMyPhone.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    wrap(<ProfilePage />);
    await waitFor(() => expect(api.getMyPhone).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    await user.click(await screen.findByRole('switch', { name: 'Events and reminders: by SMS' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check your saved number');
    expect(api.setMyPreferences).not.toHaveBeenCalled();
  });
});

describe('more page', () => {
  it('links to the timetable with no Soon badge', () => {
    wrap(<MorePage />);
    const row = screen.getByRole('link', { name: /Timetable/ });
    expect(row).toHaveAttribute('href', '/parent/timetable');
    expect(within(row).queryByText('Soon')).not.toBeInTheDocument();
    expect(screen.queryByText('Soon')).not.toBeInTheDocument();
  });
});

describe('timetable', () => {
  const lesson = (o: Record<string, unknown>) => ({
    entryId: 'x', dayOfWeek: 4, periodNumber: 1, startTime: '08:00', endTime: '08:40',
    slotLabel: null, subjectName: 'Maths', teacherName: null, room: null, ...o,
  });
  const week = [
    lesson({ entryId: 'th2', periodNumber: 2, startTime: '08:40', endTime: '09:20', subjectName: 'English', teacherName: 'Ms Achieng' }),
    lesson({ entryId: 'th1', teacherName: 'Mr Kamau', room: '3' }),
    lesson({ entryId: 'mo1', dayOfWeek: 1, subjectName: 'Science' }),
  ];
  const at = (y: number, m: number, d: number, h: number, min = 0) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(y, m, d, h, min));
  };
  afterEach(() => vi.useRealTimers());

  it("opens on today's lessons in period order and marks the one in progress", async () => {
    at(2026, 10, 5, 8, 10); // Thursday 08:10
    api.getMyChildTimetable.mockResolvedValue(week);
    wrap(<TimetablePage />);
    expect(await screen.findByRole('tab', { name: 'Thursday', selected: true })).toHaveTextContent('Today');
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Maths');
    expect(items[0]).toHaveTextContent('Mr Kamau');
    expect(items[0]).toHaveTextContent('Room 3');
    expect(items[0]).toHaveTextContent('Now');
    expect(items[1]).toHaveTextContent('English');
    expect(items[1]).not.toHaveTextContent('Now');
    expect(api.getMyChildTimetable).toHaveBeenCalledWith('a', expect.anything());
  });

  it('opens on Monday at the weekend and offers no weekend tab without weekend lessons', async () => {
    at(2026, 10, 7, 10); // Saturday
    api.getMyChildTimetable.mockResolvedValue(week);
    wrap(<TimetablePage />);
    expect(await screen.findByRole('tab', { name: 'Monday', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Science')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Saturday' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Sunday' })).not.toBeInTheDocument();
    expect(screen.queryByText('Now')).not.toBeInTheDocument();
  });

  it('adds a Saturday tab when the school has Saturday lessons', async () => {
    at(2026, 10, 5, 12);
    api.getMyChildTimetable.mockResolvedValue([...week, lesson({ entryId: 'sa1', dayOfWeek: 6, subjectName: 'Games' })]);
    const user = userEvent.setup();
    wrap(<TimetablePage />);
    await user.click(await screen.findByRole('tab', { name: 'Saturday' }));
    expect(screen.getByText('Games')).toBeInTheDocument();
  });

  it('switches day and says so when a day has no lessons', async () => {
    at(2026, 10, 5, 12);
    api.getMyChildTimetable.mockResolvedValue(week);
    const user = userEvent.setup();
    wrap(<TimetablePage />);
    await user.click(await screen.findByRole('tab', { name: 'Monday' }));
    expect(screen.getByText('Science')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Tuesday' }));
    expect(screen.getByText('No lessons on Tuesday.')).toBeInTheDocument();
  });

  it('falls back to the slot label, then Free period, when there is no subject', async () => {
    at(2026, 10, 5, 12);
    api.getMyChildTimetable.mockResolvedValue([
      lesson({ entryId: 'b', subjectName: null, slotLabel: 'Break', periodNumber: 3, startTime: '10:00', endTime: '10:20' }),
      lesson({ entryId: 'f', subjectName: null, slotLabel: null, periodNumber: 4, startTime: '10:20', endTime: '11:00' }),
    ]);
    wrap(<TimetablePage />);
    expect(await screen.findByText('Break')).toBeInTheDocument();
    expect(screen.getByText('Free period')).toBeInTheDocument();
  });

  it('explains when the school has not entered a timetable', async () => {
    wrap(<TimetablePage />);
    expect(await screen.findByText(/has not published a timetable for Grade 5/)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('does not call the server for a child with no class', async () => {
    api.getMyChildren.mockResolvedValue([{ ...amina, classId: null, className: null }]);
    wrap(<TimetablePage />);
    expect(await screen.findByText(/Amina Otieno is not placed in a class yet/)).toBeInTheDocument();
    expect(api.getMyChildTimetable).not.toHaveBeenCalled();
  });

  it('shows a retryable error', async () => {
    api.getMyChildTimetable.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    wrap(<TimetablePage />);
    expect(await screen.findByText('Could not load the timetable.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/has not published a timetable/)).toBeInTheDocument();
    expect(api.getMyChildTimetable).toHaveBeenCalledTimes(2);
  });

  it('loads the other child timetable when the child changes', async () => {
    at(2026, 10, 5, 12);
    api.getMyChildTimetable.mockImplementation(async (id: string) =>
      id === 'a' ? [lesson({ entryId: 'a1', subjectName: 'Maths' })] : [lesson({ entryId: 'b1', subjectName: 'Reading' })]
    );
    const user = userEvent.setup();
    wrap(<TimetablePage />);
    expect(await screen.findByText('Maths')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Brian/ }));
    expect(await screen.findByText('Reading')).toBeInTheDocument();
    expect(api.getMyChildTimetable).toHaveBeenCalledWith('b', expect.anything());
  });
});

describe('homework', () => {
  const hw = (o: Record<string, unknown>) => ({
    assignmentId: 'h', subjectName: 'Mathematics', title: 'Exercise', instructions: null, dueDate: '2026-11-06',
    teacherName: null, isDone: false, doneAt: null, ...o,
  });
  const at = () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 5, 12)); // Thursday 5 Nov 2026
  };
  afterEach(() => vi.useRealTimers());

  const list = [
    hw({ assignmentId: 'h1', title: 'Fractions sheet', dueDate: '2026-11-06', instructions: 'Do Q1 to Q10', teacherName: 'Mr Kamau' }),
    hw({ assignmentId: 'h2', title: 'Essay', subjectName: 'English', dueDate: '2026-11-05' }),
    hw({ assignmentId: 'h3', title: 'Old reading', subjectName: 'English', dueDate: '2026-11-02' }),
    hw({ assignmentId: 'h4', title: 'Science chart', subjectName: 'Science', dueDate: '2026-11-04', isDone: true }),
  ];

  it('groups into to do, overdue and done, soonest first, with due labels', async () => {
    at();
    api.getMyChildHomework.mockResolvedValue(list);
    wrap(<HomeworkPage />);
    expect(await screen.findByRole('heading', { name: 'To do (2)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Overdue (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Done (1)' })).toBeInTheDocument();
    const todo = screen.getByRole('heading', { name: 'To do (2)' }).closest('section') as HTMLElement;
    const titles = within(todo).getAllByText(/Essay|Fractions sheet/).map((n) => n.textContent);
    expect(titles).toEqual(['Essay', 'Fractions sheet']);
    expect(within(todo).getByText('Due today')).toBeInTheDocument();
    expect(within(todo).getByText('Due tomorrow')).toBeInTheDocument();
    expect(screen.getByText('3 days overdue')).toBeInTheDocument();
    expect(screen.getByText('Do Q1 to Q10')).toBeInTheDocument();
    expect(screen.getByText('Set by Mr Kamau')).toBeInTheDocument();
    expect(api.getMyChildHomework).toHaveBeenCalledWith('a', expect.anything());
  });

  it('says the tick is the parent own note', async () => {
    api.getMyChildHomework.mockResolvedValue(list);
    wrap(<HomeworkPage />);
    expect(await screen.findByText(/This is your own note: teachers do not mark or grade it/)).toBeInTheDocument();
  });

  it('ticks an item through the server and moves it to done', async () => {
    at();
    api.getMyChildHomework.mockResolvedValue(list);
    const user = userEvent.setup();
    wrap(<HomeworkPage />);
    await user.click(await screen.findByRole('checkbox', { name: 'Fractions sheet: mark as done' }));
    expect(api.setMyChildHomeworkDone).toHaveBeenCalledWith('h1', 'a', true);
    expect(await screen.findByRole('heading', { name: 'To do (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Done (2)' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Fractions sheet: mark as not done' })).toBeChecked();
  });

  it('unticks a done item', async () => {
    at();
    api.getMyChildHomework.mockResolvedValue(list);
    const user = userEvent.setup();
    wrap(<HomeworkPage />);
    await user.click(await screen.findByRole('checkbox', { name: 'Science chart: mark as not done' }));
    expect(api.setMyChildHomeworkDone).toHaveBeenCalledWith('h4', 'a', false);
    // due yesterday and no longer ticked: now overdue
    expect(await screen.findByRole('heading', { name: 'Overdue (2)' })).toBeInTheDocument();
  });

  it('puts the tick back and says so when the save fails', async () => {
    at();
    api.getMyChildHomework.mockResolvedValue(list);
    api.setMyChildHomeworkDone.mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    wrap(<HomeworkPage />);
    await user.click(await screen.findByRole('checkbox', { name: 'Fractions sheet: mark as done' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save that');
    expect(screen.getByRole('checkbox', { name: 'Fractions sheet: mark as done' })).not.toBeChecked();
    expect(screen.getByRole('heading', { name: 'To do (2)' })).toBeInTheDocument();
  });

  it('shows an empty state, and an all-caught-up note when only done items remain', async () => {
    wrap(<HomeworkPage />);
    expect(await screen.findByText(/No homework set for Amina right now/)).toBeInTheDocument();
  });

  it('says when everything is done', async () => {
    at();
    api.getMyChildHomework.mockResolvedValue([hw({ assignmentId: 'd', isDone: true })]);
    wrap(<HomeworkPage />);
    expect(await screen.findByText('Nothing left to do. All caught up.')).toBeInTheDocument();
  });

  it('shows a retryable error', async () => {
    api.getMyChildHomework.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    wrap(<HomeworkPage />);
    expect(await screen.findByText('Could not load homework.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/No homework set for Amina/)).toBeInTheDocument();
    expect(api.getMyChildHomework).toHaveBeenCalledTimes(2);
  });

  it('explains when the link does not include academics', async () => {
    api.getMyChildHomework.mockRejectedValueOnce(new AnalyticsAPIError('ACCESS_DENIED', 'Access denied', undefined, 403));
    wrap(<HomeworkPage />);
    expect(await screen.findByText(/has not shared homework for this child/)).toBeInTheDocument();
  });

  it('does not call the server for a child with no class', async () => {
    api.getMyChildren.mockResolvedValue([{ ...amina, classId: null, className: null }]);
    wrap(<HomeworkPage />);
    expect(await screen.findByText(/Amina Otieno is not placed in a class yet/)).toBeInTheDocument();
  });

  it('loads the other child homework when the child changes', async () => {
    api.getMyChildHomework.mockImplementation(async (id: string) =>
      [hw({ assignmentId: id, title: id === 'a' ? 'Amina task' : 'Brian task', dueDate: '2099-01-01' })]
    );
    const user = userEvent.setup();
    wrap(<HomeworkPage />);
    expect(await screen.findByText('Amina task')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Brian/ }));
    expect(await screen.findByText('Brian task')).toBeInTheDocument();
    expect(screen.queryByText('Amina task')).not.toBeInTheDocument();
    expect(api.getMyChildHomework).toHaveBeenCalledWith('b', expect.anything());
  });

  it('counts only unticked, not-yet-overdue items on the Homework tab', async () => {
    at();
    api.getMyChildHomework.mockResolvedValue(list);
    wrap(<BottomNav />);
    expect(await screen.findByRole('link', { name: 'Homework, 2 to do' })).toBeInTheDocument();
    // The unread-message badge on "More" is covered by the shortcuts test above;
    // here getMyThreads resolves to [], so asserting it would test the mock, not the UI.
  });

  it('shows no badge when nothing is to do', async () => {
    at();
    api.getMyChildHomework.mockResolvedValue([hw({ isDone: true })]);
    wrap(<BottomNav />);
    await waitFor(() => expect(api.getMyChildHomework).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('link', { name: 'Homework' })).toBeInTheDocument();
  });
});

describe('messages', () => {
  const thread = (o: Record<string, unknown> = {}) => ({
    threadId: 't1', studentId: 'a', studentName: 'Amina Otieno', audience: 'class_teacher', subject: 'Missed lessons',
    status: 'open', closedAt: null, canReopen: false, lastMessageAt: '2026-11-04T08:00:00Z', lastMessagePreview: 'Hello',
    lastSenderKind: 'parent', isUnread: false, createdAt: '2026-11-03T08:00:00Z', ...o,
  });
  const msg = (o: Record<string, unknown> = {}) => ({
    messageId: 'm1', senderKind: 'parent', senderName: 'Mary Otieno', body: 'Hello', createdAt: '2026-11-03T08:00:00Z', ...o,
  });

  describe('list', () => {
    it('lists threads with the unread reply, closed state, audience and child', async () => {
      api.getMyThreads.mockResolvedValue([
        thread({ threadId: 't1', isUnread: true, lastSenderKind: 'staff', lastMessagePreview: 'We will check' }),
        thread({ threadId: 't2', subject: 'Fee query', audience: 'bursar', status: 'closed', closedAt: '2026-11-01T08:00:00Z', studentId: 'b', studentName: 'Brian Otieno' }),
      ]);
      wrap(<MessagesPage />);
      const first = await screen.findByRole('link', { name: 'Missed lessons, unread reply' });
      expect(first).toHaveAttribute('href', '/parent/messages/t1');
      expect(within(first).getByText('New reply')).toBeInTheDocument();
      expect(within(first).getByText('Class teacher')).toBeInTheDocument();
      expect(within(first).getByText('We will check')).toBeInTheDocument();
      const second = screen.getByRole('link', { name: 'Fee query' });
      expect(within(second).getByText('Closed')).toBeInTheDocument();
      expect(within(second).getByText('Bursar')).toBeInTheDocument();
      expect(within(second).getByText('· Brian')).toBeInTheDocument();
      expect(within(second).getByText(/You: Hello/)).toBeInTheDocument();
    });

    it('shows an empty state with the new message button', async () => {
      wrap(<MessagesPage />);
      expect(await screen.findByText('No messages yet')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'New message' })).toBeInTheDocument();
    });

    it('shows a retryable error', async () => {
      api.getMyThreads.mockRejectedValueOnce(new Error('boom'));
      const user = userEvent.setup();
      wrap(<MessagesPage />);
      expect(await screen.findByText('Could not load your messages.')).toBeInTheDocument();
      api.getMyThreads.mockResolvedValue([thread()]);
      await user.click(screen.getByRole('button', { name: /Try again|Retry/ }));
      expect(await screen.findByRole('link', { name: 'Missed lessons' })).toBeInTheDocument();
    });

    it('shows the unread count on the More tab and on the Messages row', async () => {
      api.getMyThreads.mockResolvedValue([thread({ isUnread: true }), thread({ threadId: 't2', isUnread: true }), thread({ threadId: 't3' })]);
      wrap(<><MorePage /><BottomNav /></>);
      expect(await screen.findByRole('link', { name: 'More, 2 unread messages' })).toBeInTheDocument();
      const row = screen.getByRole('link', { name: /Messages.*2 unread/ });
      expect(within(row).queryByText('Soon')).not.toBeInTheDocument();
    });

    it('shows no unread badge when every reply has been read', async () => {
      api.getMyThreads.mockResolvedValue([thread()]);
      wrap(<BottomNav />);
      await waitFor(() => expect(api.getMyThreads).toHaveBeenCalled());
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole('link', { name: 'More' })).toBeInTheDocument();
    });
  });

  describe('new message', () => {
    const open = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', { name: 'New message' }));
      return screen.findByRole('dialog', { name: 'New message' });
    };

    it('sends to the chosen inbox for the chosen child and opens the new thread', async () => {
      const user = userEvent.setup();
      wrap(<MessagesPage />);
      const dialog = await open(user);
      const send = within(dialog).getByRole('button', { name: 'Send message' });
      expect(send).toBeDisabled();
      expect(await within(dialog).findByText('Ms Wanjiku')).toBeInTheDocument();

      await user.click(within(dialog).getByRole('radio', { name: /Bursar/ }));
      await user.type(within(dialog).getByLabelText('Subject'), 'Fee balance');
      expect(send).toBeDisabled();
      await user.type(within(dialog).getByLabelText('Message'), 'Please send a statement');
      expect(send).toBeEnabled();
      await user.click(send);

      expect(api.createMyThread).toHaveBeenCalledWith({ studentId: 'a', audience: 'bursar', subject: 'Fee balance', body: 'Please send a statement' });
      await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/parent/messages/t-new'));
    });

    it('says the school office will reply when the child has no class teacher', async () => {
      const user = userEvent.setup();
      wrap(<MessagesPage />);
      const dialog = await open(user);
      await within(dialog).findByText('Ms Wanjiku');
      await user.selectOptions(within(dialog).getByLabelText('About which child?'), 'b');
      expect(within(dialog).getByText('No class teacher is assigned, so the school office will reply')).toBeInTheDocument();
    });

    it('does not offer a child the school has not allowed messaging for', async () => {
      api.getMyMessageOptions.mockResolvedValue([
        { studentId: 'a', canMessageSchool: false, classTeacherName: 'Ms Wanjiku' },
        { studentId: 'b', canMessageSchool: true, classTeacherName: null },
      ]);
      const user = userEvent.setup();
      wrap(<MessagesPage />);
      const dialog = await open(user);
      await waitFor(() => expect(within(dialog).queryByLabelText('About which child?')).not.toBeInTheDocument());
      expect(within(dialog).getByText(/about Brian/)).toBeInTheDocument();
      await user.click(within(dialog).getByRole('radio', { name: /Bursar/ }));
      await user.type(within(dialog).getByLabelText('Subject'), 'Hi');
      await user.type(within(dialog).getByLabelText('Message'), 'Question');
      await user.click(within(dialog).getByRole('button', { name: 'Send message' }));
      expect(api.createMyThread).toHaveBeenCalledWith(expect.objectContaining({ studentId: 'b' }));
    });

    it('explains when messaging is off for every child', async () => {
      api.getMyMessageOptions.mockResolvedValue([
        { studentId: 'a', canMessageSchool: false, classTeacherName: null },
        { studentId: 'b', canMessageSchool: false, classTeacherName: null },
      ]);
      const user = userEvent.setup();
      wrap(<MessagesPage />);
      const dialog = await open(user);
      expect(await within(dialog).findByText(/has not turned on messaging for your account/)).toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
    });

    it('shows the daily limit message and keeps what was typed', async () => {
      api.createMyThread.mockRejectedValueOnce(new AnalyticsAPIError('SERVER_ERROR', "You have reached today's limit of 10 new messages. Please try again tomorrow."));
      const user = userEvent.setup();
      wrap(<MessagesPage />);
      const dialog = await open(user);
      await user.type(within(dialog).getByLabelText('Subject'), 'Again');
      await user.type(within(dialog).getByLabelText('Message'), 'One more');
      await user.click(within(dialog).getByRole('button', { name: 'Send message' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent("You have reached today's limit of 10 new messages");
      expect(within(dialog).getByLabelText('Message')).toHaveValue('One more');
      expect(nav.push).not.toHaveBeenCalled();
    });

    it('does not show raw server text for unexpected errors', async () => {
      api.createMyThread.mockRejectedValueOnce(new AnalyticsAPIError('SERVER_ERROR', 'relation "parent_threads" does not exist'));
      const user = userEvent.setup();
      wrap(<MessagesPage />);
      const dialog = await open(user);
      await user.type(within(dialog).getByLabelText('Subject'), 'x');
      await user.type(within(dialog).getByLabelText('Message'), 'y');
      await user.click(within(dialog).getByRole('button', { name: 'Send message' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not send your message');
    });

    it('closes with the Close button', async () => {
      const user = userEvent.setup();
      wrap(<MessagesPage />);
      const dialog = await open(user);
      await user.click(within(dialog).getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('thread', () => {
    it('shows the conversation, who wrote each message, and marks it read up to the newest message', async () => {
      nav.params = { threadId: 't1' };
      api.getMyThreads.mockResolvedValue([thread({ isUnread: true, lastSenderKind: 'staff' })]);
      api.getMyThreadMessages.mockResolvedValue([
        msg({ messageId: 'm1', body: 'Amina missed Monday.', createdAt: '2026-11-03T08:00:00Z' }),
        msg({ messageId: 'm2', senderKind: 'staff', senderName: 'Ms Wanjiku', body: 'Thanks, noted.', createdAt: '2026-11-04T09:30:00Z' }),
      ]);
      wrap(<><ThreadPage /><BottomNav /></>);
      expect(await screen.findByText('Amina missed Monday.')).toBeInTheDocument();
      expect(screen.getByText('Thanks, noted.')).toBeInTheDocument();
      expect(screen.getByText(/^You · /)).toBeInTheDocument();
      expect(screen.getByText(/^Ms Wanjiku · /)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Missed lessons' })).toBeInTheDocument();
      await waitFor(() => expect(api.markMyThreadRead).toHaveBeenCalledWith('t1', '2026-11-04T09:30:00Z'));
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole('link', { name: 'More' })).toBeInTheDocument();
      expect(api.getMyThreadMessages).toHaveBeenCalledWith('t1', expect.anything());
    });

    it('does not mark a thread read when the school has not replied', async () => {
      nav.params = { threadId: 't1' };
      api.getMyThreads.mockResolvedValue([thread()]);
      api.getMyThreadMessages.mockResolvedValue([msg()]);
      wrap(<ThreadPage />);
      expect(await screen.findByText('Hello', { selector: 'p' })).toBeInTheDocument();
      expect(api.markMyThreadRead).not.toHaveBeenCalled();
    });

    it('sends a reply through the server and shows the refreshed conversation', async () => {
      nav.params = { threadId: 't1' };
      api.getMyThreads.mockResolvedValue([thread()]);
      api.getMyThreadMessages
        .mockResolvedValueOnce([msg()])
        .mockResolvedValue([msg(), msg({ messageId: 'm3', body: 'Another question' })]);
      const user = userEvent.setup();
      wrap(<ThreadPage />);
      const box = await screen.findByLabelText('Your reply');
      const send = screen.getByRole('button', { name: 'Send' });
      expect(send).toBeDisabled();
      await user.type(box, 'Another question');
      await user.click(send);
      expect(api.sendMyThreadMessage).toHaveBeenCalledWith('t1', 'Another question');
      expect(await screen.findByText('Another question', { selector: 'p' })).toBeInTheDocument();
      expect(box).toHaveValue('');
    });

    it('keeps the typed reply and shows the server message when the thread was closed meanwhile', async () => {
      nav.params = { threadId: 't1' };
      api.getMyThreads.mockResolvedValue([thread()]);
      api.getMyThreadMessages.mockResolvedValue([msg()]);
      api.sendMyThreadMessage.mockRejectedValueOnce(new AnalyticsAPIError('SERVER_ERROR', 'This conversation is closed. Reopen it to reply.'));
      const user = userEvent.setup();
      wrap(<ThreadPage />);
      const box = await screen.findByLabelText('Your reply');
      await user.type(box, 'Still there?');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('This conversation is closed. Reopen it to reply.');
      expect(box).toHaveValue('Still there?');
    });

    it('offers to reopen a closed thread within the window', async () => {
      nav.params = { threadId: 't1' };
      api.getMyThreads.mockResolvedValue([thread({ status: 'closed', closedAt: '2026-11-01T08:00:00Z', canReopen: true })]);
      api.getMyThreadMessages.mockResolvedValue([msg()]);
      const user = userEvent.setup();
      wrap(<ThreadPage />);
      expect(await screen.findByText('This conversation is closed.')).toBeInTheDocument();
      expect(screen.queryByLabelText('Your reply')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Reopen conversation' }));
      expect(api.reopenMyThread).toHaveBeenCalledWith('t1');
    });

    it('sends the parent to a new message when a closed thread can no longer be reopened', async () => {
      nav.params = { threadId: 't1' };
      api.getMyThreads.mockResolvedValue([thread({ status: 'closed', closedAt: '2026-09-01T08:00:00Z', canReopen: false })]);
      api.getMyThreadMessages.mockResolvedValue([msg()]);
      wrap(<ThreadPage />);
      expect(await screen.findByText(/can no longer be reopened/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Start a new message' })).toHaveAttribute('href', '/parent/messages');
      expect(screen.queryByRole('button', { name: 'Reopen conversation' })).not.toBeInTheDocument();
    });

    it('says when the conversation is not found', async () => {
      nav.params = { threadId: 'missing' };
      api.getMyThreads.mockResolvedValue([thread()]);
      wrap(<ThreadPage />);
      expect(await screen.findByText('Conversation not found')).toBeInTheDocument();
      expect(api.getMyThreadMessages).not.toHaveBeenCalled();
    });

    it('shows a retryable error when the messages fail to load', async () => {
      nav.params = { threadId: 't1' };
      api.getMyThreads.mockResolvedValue([thread()]);
      api.getMyThreadMessages.mockRejectedValueOnce(new Error('boom'));
      api.getMyThreadMessages.mockResolvedValue([msg({ body: 'Back again' })]);
      const user = userEvent.setup();
      wrap(<ThreadPage />);
      expect(await screen.findByText('Could not load this conversation.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Try again|Retry/ }));
      expect(await screen.findByText('Back again')).toBeInTheDocument();
    });
  });
});

describe('reminder preferences', () => {
  const defaults = {
    homeworkDueTomorrow: true, eventReminders: true, replyNotifications: true,
    smsHomeworkDueTomorrow: false, smsEventReminders: false, smsReplyNotifications: false,
  };

  it('shows in-app on and SMS off by default for the three reminders', async () => {
    wrap(<ProfilePage />);
    expect(await screen.findByRole('switch', { name: 'Homework due tomorrow: in the app' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Homework due tomorrow: by SMS' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Events and reminders: in the app' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Replies to my messages: by SMS' })).not.toBeChecked();
    expect(screen.getByText(/the school has not started sending SMS reminders yet/)).toBeInTheDocument();
  });

  it('saves the whole set of choices when one is switched', async () => {
    api.getMyPhone.mockResolvedValue('254712345678');
    const user = userEvent.setup();
    wrap(<ProfilePage />);
    await screen.findByDisplayValue('0712 345 678');
    await user.click(await screen.findByRole('switch', { name: 'Events and reminders: by SMS' }));
    expect(api.setMyPreferences).toHaveBeenCalledWith({ ...defaults, smsEventReminders: true });
    expect(screen.getByRole('switch', { name: 'Events and reminders: by SMS' })).toBeChecked();
  });

  it('puts the switch back and says so when the save fails', async () => {
    api.setMyPreferences.mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    wrap(<ProfilePage />);
    await user.click(await screen.findByRole('switch', { name: 'Homework due tomorrow: in the app' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save that');
    expect(screen.getByRole('switch', { name: 'Homework due tomorrow: in the app' })).toBeChecked();
  });

  it('shows a retryable error when the settings fail to load', async () => {
    api.getMyPreferences.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    wrap(<ProfilePage />);
    expect(await screen.findByText('Could not load your reminder settings.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Try again|Retry/ }));
    expect(await screen.findByRole('switch', { name: 'Homework due tomorrow: in the app' })).toBeInTheDocument();
  });

  it('hides the unread count when in-app reply notifications are off', async () => {
    api.getMyPreferences.mockResolvedValue({ ...defaults, replyNotifications: false });
    api.getMyThreads.mockResolvedValue([
      { threadId: 't1', studentId: 'a', studentName: 'Amina Otieno', audience: 'class_teacher', subject: 'S', status: 'open', closedAt: null, canReopen: false, lastMessageAt: '2026-11-04T08:00:00Z', lastMessagePreview: 'x', lastSenderKind: 'staff', isUnread: true, createdAt: '2026-11-03T08:00:00Z' },
    ]);
    wrap(<BottomNav />);
    await waitFor(() => expect(api.getMyPreferences).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('link', { name: 'More' })).toBeInTheDocument();
  });
});
