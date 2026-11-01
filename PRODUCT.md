# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are school administrators and bursars in Kenyan primary, junior, and senior schools (Grades 1–12, day and boarding, multi-campus tenants). Secondary users include principals, teachers, class teachers, exams officers, HR/staff managers, storekeepers, parents/guardians, learners, and platform super-admins.

Key roles:
- **School owner/director** — school oversight and strategic decisions
- **Headteacher/principal** — academic leadership and daily operations
- **Administrator** — school records, users, and administration
- **Teacher** — teaching, attendance, and assessment records
- **Class/grade teacher** — learner welfare and grade-level coordination
- **Exams officer** — assessment coordination and results
- **Bursar/accountant** — fees, payments, expenses, and financial reporting
- **HR/staff manager** — staff records and workforce administration
- **Storekeeper/procurement officer** — supplies, stock, and purchasing
- **Parent/guardian** — monitor their child's progress and authorised records
- **Learner** — access permitted academic information
- **Platform super-admin** — manage school tenants and platform-level controls

## Product Purpose

TUSOME is a comprehensive school management system for Kenyan primary, junior, and senior schools (Grades 1–12). It covers admissions, learner records, attendance, academics (CBE curriculum, exams, grading, reports), finance (fees, payments, invoices, receipts, budgets, accounting), staff management, timetables, communication (SMS), library, transport, boarding, sports, trips, and analytics.

Success means: a school can run all daily operations — from admissions to report cards to fee collection to payroll — from a single, secure, multi-tenant system without spreadsheets or disconnected tools.

## Positioning

Zeraki Analytics parity for school analytics and reporting. Free SMS via device SIM (no per-message gateway fees). Multi-tenant Kenyan CBE focus (Grades 1–12, day/boarding, multi-campus). Built specifically for Kenyan primary, junior, and senior schools.

## Capabilities

- 72 analytics and management pages
- 52 database migrations with RLS on all tables
- 290+ API functions (Supabase RPCs)
- 130+ TypeScript types
- Multi-tenant with JWT-based tenant isolation
- 60+ granular permissions across 7 categories
- 7 built-in roles + custom roles
- Zeraki Analytics parity (dashboard, reports, merit list, mark sheet, etc.)
- Complete finance module (fees, payments, invoices, receipts, wallets, budgets, accounting, audit trail)
- SMS gateway via device SIM (free, no per-message fees)
- Daily attendance, leave management, duty rosters
- Library, transport, boarding, sports, trips management
- Payroll with Kenyan statutory deductions (PAYE, NSSF, SHA/SHIF, AHL)

## Constraints

- Existing database schema (52 migrations) — must not break
- Tenant isolation and RLS on all tables
- Kenyan CBE curriculum (Grades 1–12, strands, substrands, pathways)
- Multi-tenant (schools are tenants)
- No new auth system — use existing Supabase auth
- No second student registry
- No college/TVET/generic billing

## Platform

web

## Stack

Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth + RLS), Playwright (PDF generation)