'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard, BarChart3, Users, ArrowLeftRight, UsersRound, Home,
  GitBranch, BookOpen, FileText, School, Calendar, ClipboardList, CheckSquare,
  AlertTriangle, UserCog, CalendarOff, ClipboardCheck, Activity, MessageSquare,
  Stethoscope, DollarSign, Receipt, Wallet, Calculator, Building2, Landmark,
  PiggyBank, CreditCard, Settings, MessageCircle, Bell, Library, Bus,
  Home as HomeIcon, Trophy, Award, FileSpreadsheet, ScrollText, Shield,
  Database, CalendarDays, TrendingUp, Target,
} from 'lucide-react';
import { Alert, Skeleton } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { describeAnalyticsError } from '@/lib/analytics/api';
import type { Session } from '@supabase/supabase-js';

type AuthState = 'loading' | 'authenticated' | 'anonymous' | 'misconfigured';

function loginHref(pathname: string): string {
  const next = pathname && pathname.startsWith('/') ? pathname : '/analytics';
  return `/login?next=${encodeURIComponent(next)}`;
}

import type { LucideIcon } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { href: '/analytics', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/analytics/analysis', label: 'Analysis', icon: BarChart3 },
    ],
  },
  {
    title: 'Students',
    items: [
      { href: '/analytics/students', label: 'Student Directory', icon: Users },
      { href: '/analytics/students/move', label: 'Move Students', icon: ArrowLeftRight },
      { href: '/analytics/student-groups', label: 'Student Groups', icon: UsersRound },
      { href: '/analytics/residences', label: 'Residences', icon: Home },
      { href: '/analytics/parents', label: 'Parent Links', icon: Users },
      { href: '/analytics/pathways', label: 'Pathways', icon: GitBranch },
    ],
  },
  {
    title: 'Academics',
    items: [
      { href: '/analytics/exams', label: 'Exams & Marks', icon: ClipboardList },
      { href: '/analytics/subjects', label: 'Subjects', icon: BookOpen },
      { href: '/analytics/subject-papers', label: 'Subject Papers', icon: FileText },
      { href: '/analytics/classes', label: 'Classes & Streams', icon: School },
      { href: '/analytics/timetable', label: 'Timetable', icon: Calendar },
      { href: '/analytics/lesson-plans', label: 'Lesson Plans', icon: ClipboardList },
      { href: '/analytics/curriculum-coverage', label: 'Curriculum Coverage', icon: CheckSquare },
    ],
  },
  {
    title: 'Attendance & Behaviour',
    items: [
      { href: '/analytics/attendance', label: 'Exam Attendance', icon: ClipboardList },
      { href: '/analytics/daily-attendance', label: 'Daily Attendance', icon: Calendar },
      { href: '/analytics/behaviour', label: 'Behaviour', icon: AlertTriangle },
    ],
  },
  {
    title: 'Staff',
    items: [
      { href: '/analytics/staff', label: 'Staff Directory', icon: UserCog },
      { href: '/analytics/leave', label: 'Leave', icon: CalendarOff },
      { href: '/analytics/duty-rosters', label: 'Duty Rosters', icon: ClipboardList },
      { href: '/analytics/teacher-workload', label: 'Teacher Workload', icon: LayoutDashboard },
      { href: '/analytics/counselling', label: 'Counselling', icon: MessageSquare },
      { href: '/analytics/medical', label: 'Medical', icon: Stethoscope },
    ],
  },
  {
    title: 'Finance',
    items: [
      { href: '/analytics/finance', label: 'Fee Management', icon: DollarSign },
      { href: '/analytics/fee-waivers', label: 'Fee Waivers', icon: Receipt },
      { href: '/analytics/billing', label: 'Billing & Invoices', icon: Receipt },
      { href: '/analytics/wallet', label: 'Wallet', icon: Wallet },
      { href: '/analytics/accounting', label: 'Accounting', icon: Calculator },
      { href: '/analytics/bank-reconciliation', label: 'Bank Reconciliation', icon: Building2 },
      { href: '/analytics/budgets', label: 'Budgets', icon: LayoutDashboard },
      { href: '/analytics/payroll', label: 'Payroll', icon: CreditCard },
      { href: '/analytics/salary-components', label: 'Salary Components', icon: Settings },
      { href: '/analytics/employee-salaries', label: 'Employee Salaries', icon: UserCog },
    ],
  },
  {
    title: 'Communication',
    items: [
      { href: '/analytics/messages', label: 'Messaging & SMS', icon: MessageCircle },
      { href: '/analytics/events', label: 'Events & Notices', icon: Bell },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/analytics/library', label: 'Library', icon: Library },
      { href: '/analytics/transport', label: 'Transport', icon: Bus },
      { href: '/analytics/boarding', label: 'Boarding', icon: Home },
      { href: '/analytics/sports', label: 'Sports', icon: Trophy },
      { href: '/analytics/trips', label: 'Trips', icon: CalendarDays },
      { href: '/analytics/opportunities', label: 'Opportunities', icon: Target },
      { href: '/analytics/exam-comments', label: 'Exam Comments', icon: MessageSquare },
    ],
  },
  {
    title: 'Analytics & Reports',
    items: [
      { href: '/analytics/merit-list', label: 'Merit List', icon: Trophy },
      { href: '/analytics/mark-sheet', label: 'Mark Sheet', icon: ClipboardList },
      { href: '/analytics/report-forms', label: 'Report Forms', icon: FileText },
      { href: '/analytics/transcript', label: 'Transcripts', icon: ScrollText },
    ],
  },
  {
    title: 'Administration',
    items: [
      { href: '/analytics/accounts', label: 'Accounts & Roles', icon: UserCog },
      { href: '/analytics/settings', label: 'Settings', icon: Settings },
      { href: '/analytics/audit-log', label: 'Audit Log', icon: Shield },
      { href: '/analytics/data-retention', label: 'Data Retention', icon: Database },
      { href: '/analytics/fiscal-periods', label: 'Fiscal Periods', icon: CalendarDays },
      { href: '/analytics/budgets', label: 'Budgets', icon: LayoutDashboard },
      { href: '/analytics/accounting', label: 'Accounting', icon: Calculator },
    ],
  },
];

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let supabase;
    try {
      supabase = createClient();
    } catch (error) {
      setConfigError(
        describeAnalyticsError(error, 'Supabase is not configured for this deployment.')
      );
      setState('misconfigured');
      return;
    }

    let disposed = false;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (disposed) return;
        if (error) {
          setConfigError(describeAnalyticsError(error, 'Could not check your session.'));
          setState('misconfigured');
          return;
        }
        setSession(data.session);
        if (data.session) {
          setState('authenticated');
        } else {
          setState('anonymous');
          router.replace(loginHref(pathname));
        }
      })
      .catch((error) => {
        if (disposed) return;
        setConfigError(describeAnalyticsError(error, 'Could not check your session.'));
        setState('misconfigured');
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (disposed) return;
      setSession(nextSession);
      if (nextSession) {
        setState('authenticated');
        return;
      }
      setState('anonymous');
      if (event === 'SIGNED_OUT') router.replace(loginHref(pathname));
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  const signOut = async () => {
    try {
      await createClient().auth.signOut();
    } finally {
      router.replace('/login');
    }
  };

  if (state === 'misconfigured') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Alert tone="error" title="Supabase is not configured">
          {configError} Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code>, then
          rebuild. See <code>.env.example</code>.
        </Alert>
      </main>
    );
  }

  if (state === 'loading' || state === 'anonymous') {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-busy="true">
        <span className="sr-only">
          {state === 'loading' ? 'Checking your session…' : 'Redirecting to sign in…'}
        </span>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-4 w-72" />
        <Skeleton className="mt-8 h-20 w-full" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-slate-900 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 border-b border-slate-700 px-4 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              T
            </span>
            <div>
              <span className="text-sm font-bold text-white">TUSOME</span>
              <span className="block text-xs text-slate-400">School Management</span>
            </div>
            <button
              className="ml-auto text-slate-400 hover:text-white lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="mb-4">
                <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href + item.label}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* User info at bottom */}
          <div className="border-t border-slate-700 px-4 py-3">
            {session?.user.email && (
              <p className="truncate text-xs text-slate-400">{session.user.email}</p>
            )}
            <button
              type="button"
              onClick={signOut}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm print:hidden">
          <button
            className="text-gray-600 hover:text-gray-900 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">TUSOME Analytics</span>
          </div>
          <div className="flex items-center gap-3">
            {session?.user.email && (
              <span className="hidden text-sm text-gray-600 sm:inline">
                {session.user.email}
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
