import {
  LayoutDashboard, BarChart3, Users, ArrowLeftRight, UsersRound, Home, GitBranch, BookOpen,
  FileText, School, Calendar, ClipboardList, CheckSquare, AlertTriangle, UserCog, CalendarOff,
  MessageSquare, Stethoscope, DollarSign, Receipt, Wallet, Calculator, Building2, CreditCard,
  Settings, MessageCircle, Bell, Library, Bus, Trophy, ScrollText, Shield, Database,
  CalendarDays, Target, GraduationCap, ClipboardCheck, Briefcase, Landmark, Boxes, Megaphone,
  PiggyBank, Medal, ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { canAccessRoute } from '@/lib/analytics/routePermissions';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra words the page search matches on. */
  keywords?: string;
}

export interface NavGroup {
  id: string;
  title: string;
  /** Short label under the rail icon. */
  short: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const HOME_ITEM: NavItem = {
  href: '/analytics',
  label: 'Dashboard',
  icon: LayoutDashboard,
  keywords: 'home overview analytics',
};

/** Nine groups instead of one 60-link list. Each opens as a flyout from the rail. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'students',
    title: 'Students',
    short: 'Students',
    icon: GraduationCap,
    items: [
      { href: '/analytics/students', label: 'Student Directory', icon: Users, keywords: 'learners admission' },
      { href: '/analytics/students/new', label: 'Admit a Student', icon: GraduationCap, keywords: 'new admission register' },
      { href: '/analytics/students/move', label: 'Move Students', icon: ArrowLeftRight, keywords: 'promote transfer' },
      { href: '/analytics/student-groups', label: 'Student Groups', icon: UsersRound },
      { href: '/analytics/residences', label: 'Residences', icon: Home, keywords: 'dorm house' },
      { href: '/analytics/parents', label: 'Parent Links', icon: Users, keywords: 'guardian' },
      { href: '/analytics/pathways', label: 'Pathways', icon: GitBranch, keywords: 'senior school cbe' },
    ],
  },
  {
    id: 'academics',
    title: 'Academics',
    short: 'Academics',
    icon: BookOpen,
    items: [
      { href: '/analytics/exams', label: 'Exams & Marks', icon: ClipboardList, keywords: 'assessment results' },
      { href: '/analytics/subjects', label: 'Subjects', icon: BookOpen },
      { href: '/analytics/subject-papers', label: 'Subject Papers', icon: FileText },
      { href: '/analytics/classes', label: 'Classes & Streams', icon: School },
      { href: '/analytics/timetable', label: 'Timetable', icon: Calendar },
      { href: '/analytics/homework', label: 'Homework', icon: ClipboardList, keywords: 'assignments set homework' },
      { href: '/analytics/lesson-plans', label: 'Lesson Plans', icon: ClipboardList },
      { href: '/analytics/curriculum-coverage', label: 'Curriculum Coverage', icon: CheckSquare },
      { href: '/analytics/exam-comments', label: 'Exam Comments', icon: MessageSquare },
    ],
  },
  {
    id: 'attendance',
    title: 'Attendance & Conduct',
    short: 'Attendance',
    icon: ClipboardCheck,
    items: [
      { href: '/analytics/daily-attendance', label: 'Daily Attendance', icon: Calendar, keywords: 'register roll call' },
      { href: '/analytics/attendance', label: 'Exam Attendance', icon: ClipboardList },
      { href: '/analytics/behaviour', label: 'Behaviour', icon: AlertTriangle, keywords: 'discipline' },
      { href: '/analytics/counselling', label: 'Counselling', icon: MessageSquare },
      { href: '/analytics/medical', label: 'Medical', icon: Stethoscope, keywords: 'sickbay health' },
    ],
  },
  {
    id: 'staff',
    title: 'Staff',
    short: 'Staff',
    icon: Briefcase,
    items: [
      { href: '/analytics/staff', label: 'Staff Directory', icon: UserCog },
      { href: '/analytics/teachers', label: 'Teachers', icon: UserCog, keywords: 'allocations' },
      { href: '/analytics/leave', label: 'Leave', icon: CalendarOff },
      { href: '/analytics/duty-rosters', label: 'Duty Rosters', icon: ClipboardList },
      { href: '/analytics/teacher-workload', label: 'Teacher Workload', icon: LayoutDashboard },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    short: 'Finance',
    icon: Wallet,
    items: [
      { href: '/analytics/finance', label: 'Fee Management', icon: DollarSign, keywords: 'payments balances' },
      { href: '/analytics/fee-waivers', label: 'Fee Waivers', icon: Receipt, keywords: 'bursary discount' },
      { href: '/analytics/billing', label: 'Billing & Invoices', icon: Receipt },
      { href: '/analytics/wallet', label: 'Wallet', icon: Wallet, keywords: 'mpesa' },
      { href: '/analytics/accounting', label: 'Accounting', icon: Calculator, keywords: 'ledger journal' },
      { href: '/analytics/bank-reconciliation', label: 'Bank Reconciliation', icon: Landmark },
      { href: '/analytics/budgets', label: 'Budgets', icon: PiggyBank },
      { href: '/analytics/fiscal-periods', label: 'Fiscal Periods', icon: CalendarDays },
      { href: '/analytics/payroll', label: 'Payroll', icon: CreditCard, keywords: 'payslip paye nssf' },
      { href: '/analytics/salary-components', label: 'Salary Components', icon: Settings },
      { href: '/analytics/employee-salaries', label: 'Employee Salaries', icon: UserCog },
    ],
  },
  {
    id: 'communication',
    title: 'Communication',
    short: 'Inbox',
    icon: Megaphone,
    items: [
      { href: '/analytics/messages', label: 'Messaging & SMS', icon: MessageCircle },
      { href: '/analytics/parent-messages', label: 'Parent messages', icon: MessageSquare, keywords: 'inbox parents reply conversations' },
      { href: '/analytics/events', label: 'Events & Notices', icon: Bell, keywords: 'calendar announcements' },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    short: 'Campus',
    icon: Boxes,
    items: [
      { href: '/analytics/library', label: 'Library', icon: Library },
      { href: '/analytics/transport', label: 'Transport', icon: Bus, keywords: 'bus routes' },
      { href: '/analytics/boarding', label: 'Boarding', icon: Building2 },
      { href: '/analytics/sports', label: 'Sports', icon: Trophy },
      { href: '/analytics/trips', label: 'Trips', icon: CalendarDays, keywords: 'permission slip' },
      { href: '/analytics/opportunities', label: 'Opportunities', icon: Target },
    ],
  },
  {
    id: 'reports',
    title: 'Reports & Analysis',
    short: 'Reports',
    icon: BarChart3,
    items: [
      { href: '/analytics/analysis', label: 'Analysis', icon: BarChart3 },
      { href: '/analytics/merit-list', label: 'Merit List', icon: Medal, keywords: 'ranking positions' },
      { href: '/analytics/mark-sheet', label: 'Mark Sheet', icon: ClipboardList },
      { href: '/analytics/report-forms', label: 'Report Forms', icon: FileText, keywords: 'report cards' },
      { href: '/analytics/transcript', label: 'Transcripts', icon: ScrollText },
    ],
  },
  {
    id: 'admin',
    title: 'Administration',
    short: 'Admin',
    icon: ShieldCheck,
    items: [
      { href: '/analytics/schools', label: 'Schools', icon: Building2, keywords: 'tenants add school platform' },
      { href: '/analytics/accounts', label: 'Accounts & Roles', icon: UserCog, keywords: 'users permissions' },
      { href: '/analytics/settings', label: 'Settings', icon: Settings, keywords: 'school profile' },
      { href: '/analytics/audit-log', label: 'Audit Log', icon: Shield },
      { href: '/analytics/data-retention', label: 'Data Retention', icon: Database, keywords: 'privacy odpc' },
    ],
  },
];

/** Role-aware navigation: platform super admins only manage schools; finance hidden without view-fees. */
export function navGroupsForRole(role: string | null | undefined, permissions?: string[] | null): NavGroup[] {
  if (role === 'super admin') {
    const admin = NAV_GROUPS.find((group) => group.id === 'admin');
    if (!admin) return [];
    return [
      {
        ...admin,
        items: admin.items.filter((item) => item.href === '/analytics/schools'),
      },
    ];
  }
  const hasFinance = (permissions ?? []).some((p) => p === 'view-fees' || p === 'manage-fees' || p === 'manage-fees');
  const groups = hasFinance ? NAV_GROUPS : NAV_GROUPS.filter((g) => g.id !== 'finance');
  // Filter individual nav items by route permission.
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessRoute(permissions ?? null, item.href)),
    }))
    .filter((group) => group.items.length > 0);
}

export function searchEntriesForRole(role: string | null | undefined, permissions?: string[] | null): SearchEntry[] {
  const allowed = new Set(navGroupsForRole(role, permissions).flatMap((group) => group.items.map((item) => item.href)));
  allowed.add(HOME_ITEM.href);
  return SEARCH_ENTRIES.filter((entry) => allowed.has(entry.href));
}

export function searchNavForRole(query: string, role: string | null | undefined, permissions?: string[] | null): SearchEntry[] {
  const entries = searchEntriesForRole(role, permissions);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries;
  return entries.filter((entry) => {
    const hay = `${entry.label} ${entry.groupTitle} ${entry.keywords ?? ''}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}

export interface ActiveNav {
  group: NavGroup | null;
  item: NavItem | null;
}

/** Most specific match wins, so /analytics/students/123 resolves to Student Directory. */
export function findActiveNav(pathname: string): ActiveNav {
  let best: ActiveNav = { group: null, item: null };
  let bestLen = -1;
  const consider = (group: NavGroup | null, item: NavItem) => {
    const hit =
      pathname === item.href ||
      (item.href !== '/analytics' && pathname.startsWith(`${item.href}/`));
    if (hit && item.href.length > bestLen) {
      best = { group, item };
      bestLen = item.href.length;
    }
  };
  consider(null, HOME_ITEM);
  for (const group of NAV_GROUPS) for (const item of group.items) consider(group, item);
  return best;
}

export interface SearchEntry extends NavItem {
  groupTitle: string;
}

export const SEARCH_ENTRIES: SearchEntry[] = [
  { ...HOME_ITEM, groupTitle: 'Overview' },
  ...NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, groupTitle: group.title }))),
];

export function searchNav(query: string): SearchEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return SEARCH_ENTRIES;
  return SEARCH_ENTRIES.filter((entry) => {
    const hay = `${entry.label} ${entry.groupTitle} ${entry.keywords ?? ''}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}
