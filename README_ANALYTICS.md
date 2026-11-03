# TUSOME Analytics (Zeraki-style)

Analytics and report-card features for TUSOME, modelled on Zeraki Analytics.

## Features

### Dashboard (`/analytics`)
- **Class Performance** — ranked student list with totals, means, grades, positions, and **Export CSV**
- **Summary cards** — students with marks, class mean, highest mean, pass rate
- **Grade Distribution** — breakdown per grade band with counts and percentages
- **Subject Performance** — per-subject means, pass rates, and EE/ME/AE/BE counts
- **Filters** — academic year, exam, class, stream (class/stream resolve through the latest enrollment)
- **States** — loading, empty ("no published exams", "no students with marks"), and a visible error with **Retry** for both the filter load and the analytics load. Results are cleared before each fetch so stale numbers are never shown for a different selection.
- **Scope note** — positions follow the current class/stream filters; removing them shows the whole-exam ranking. Pass rate uses the documented `score >= 40` assumption.

### Student Reports (`/analytics/report/[studentId]`)
- **Report Card** — printable report with student details, subject grades, total, mean, subject count, and position
- **CBC grading** — grades come from the tenant's grading configuration via `get_grade_for_score`
- **Header** — class/stream/academic year resolved from the authoritative enrollment (`20261028000003`), falling back to `students.*` only when no enrollment exists
- **Print support** — **Print / Save as PDF** uses browser print (Ctrl+P / Cmd+P); navigation and buttons are hidden in print

### Parity reports (Zeraki printouts)
- **Merit List** (`/analytics/merit-list`) — every student with a previous published exam, ranked by mean improvement. Search, sortable columns, CSV export.
- **Mark Sheet** (`/analytics/mark-sheet`) — student × subject matrix for one published exam, with score, configured grade and points. Search, sort, CSV export.
- **Analysis Report** (`/analytics/analysis`) — class average, per-subject means/spread/pass rate, grade distribution and the most-improved students.
- **Student Analytics** (`/analytics/student/[studentId]`) — subject marks for the selected exam plus published-exam history with mean, grade and dense-ranked position.
- **Transcript** (`/analytics/transcript/[studentId]`) — published exam history grouped by academic year, printable to PDF.
- **Report Forms** (`/analytics/report-forms`) — class-level report card generation page (Zeraki `printouts/reportForms` parity) with report type selector (`Exam Only` vs `Evaluations & Exams`), class grade summary table, most-improved students, and per-student report card links for printing.
- **Dashboard cards** — the dashboard shows the class grade summary and analysis report inline and links to each report for the current exam/class/stream selection.

### Exams, Marks & Publishing Pipeline (`/analytics/exams`)
- **4-Stage Zeraki Exam-to-Reports Flow**:
  1. **Create Exam (`Draft`)** — administrators create an exam (`name`, `term`, `academic_year`, `assessment_component`, and participating `exam_classes`).
  2. **Key-in Subject Marks (`/analytics/exams/[examId]`)** — teachers and admins enter or clear 0–100 subject scores per student on the enrolled class/stream roster while the exam is in `draft`, `review`, or `reopened` status, with live preview grades from `get_grade_for_score`.
  3. **Readiness & Publish** — administrators review per-subject completion (`recorded_marks` vs `missing_marks` and subject mean) and publish the exam (`status = 'published'`), which locks marks via `marks_editable_guard` and exposes the exam in `get_analytics_filters()`.
  4. **Flow to Reports & Reopen** — published exams immediately unlock the Dashboard, Merit List, Mark Sheet, Analysis Report, Student Report Cards, Student Analytics, and Transcripts; administrators can also reopen (`status = 'reopened'`) to amend marks and re-publish.

### Accounts, Roles, Permissions & Section Heads (`/analytics/accounts`)
- **School account directory** — lists every profile in the caller's tenant (`full_name`, `email` from `profiles.email` or `auth.users.email`, `role`, `staff_type` (`TEACHER` / `OFFICIAL` / `WORKER`), `is_active`, `access_revoked`, `granted_overrides`, `denied_overrides`, `created_at`) with search, role, staff-type, and status filters.
- **Invite / create & edit accounts** — tenant administrators (`admin`, `super admin`, `owner`, `principal`, `director`) can invite/create new accounts, edit name/email/role/staff-type/active status inline, and revoke or restore all access (`set_user_access_revoked`).
- **Global & custom roles + permission catalogue** — 7 built-in Zeraki `GLOBAL` roles (`Administrator`, `Principal`, `Deputy principal`, `Director`, `Secretary`, `Teacher`, `Non-teaching staff`) plus custom roles (`upsert_custom_role`, `delete_custom_role`) backed by the 60+ Zeraki permissions across 7 categories (`permissions`, `roles`, `role_permissions`).
- **Role detail page** (`/analytics/accounts/[role]`) — **Members** tab (with inline edit, access revocation, and add-member form) and **Permissions** tab (categorized permission checklist).
- **Per-user permission overrides** (`/analytics/accounts/[role]/user/[userId]`) — **Granted**, **Eligible**, and **Restricted** tabs (`user_permissions` `GRANT`/`DENY` overrides) plus the **Revoke All Access / Restore Access** banner.
- **Section Heads** (`/analytics/accounts` → **Section Heads** tab) — assign, edit, and remove section heads across all 15 Zeraki form levels (`PRE_SCHOOL` through `MYP`).
- **Header navigation** — linked from the `AuthGate` top bar on every analytics route.

### Messaging & SMS (`/analytics/messages`)
- **Compose & Send** — compose SMS messages to parents, teachers, staff, specific classes/students, or keyed-in phone numbers. Supports text, exam results, and fee information message types.
- **Free SMS** - completely free, no credits or purchases needed. Messages sent via device SIM card.
- **Message History** - table with date, type, recipients, message preview, count, and status badges.
- **SMS Gateway (Device SIM)** — messages are queued in the database and sent by a companion Android device using the device's SIM card via Android's `SmsManager` API. No per-message gateway fees.
- **Reverse-engineered from "Multi SMS Sender (MSS)"** — an Android app that sends SMS via `SmsManager.sendTextMessage()` through the device's SIM card. Requires `SEND_SMS` and `READ_SMS` permissions. Supports dual SIM, delivery tracking, and batch sending.
- **Companion App Spec** — see `docs/SMS_GATEWAY_COMPANION_APP.md` for the full companion app specification with Kotlin code.

### Access
- Client-side Supabase auth gate (`AuthGate`) wraps `/analytics`; unauthenticated visitors are redirected to `/login`
- `/login` signs in with Supabase email/password and returns to the requested analytics route
- No service-role key is used in the browser; the app only needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Database tenant guards remain the authority: every RPC fails closed without a matching JWT `tenant_id` claim

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in the public URL and publishable key
npm run dev                  # http://localhost:3000/analytics
```

Required environment variables (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the anon/publishable key — never a service-role key)

Verification commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run db:test` for the disposable SQL harness (after installing its dependencies per `supabase/tests/disposable/README.md`).

## Database functions (Supabase RPCs)

| Function | Purpose |
| --- | --- |
| `get_class_performance(exam_id, class_id, stream_id)` | Student totals, means, positions, overall grade |
| `get_grade_distribution(exam_id, class_id, stream_id)` | Grade-band counts and percentages |
| `get_subject_performance(exam_id, class_id, stream_id)` | Subject means, pass rate, EE/ME/AE/BE counts |
| `get_student_report_data(student_id, exam_id)` | Full report payload as JSON |
| `get_mark_sheet(exam_id, class_id, stream_id)` | Student × subject marks with configured grade and points |
| `get_student_exam_history(student_id)` | Published-exam history with mean, grade and dense-ranked position |
| `get_most_improved(exam_id, class_id, stream_id)` | Current vs previous published-exam mean per student |
| `get_account_directory()` | Directory of accounts (`account_id`, `full_name`, `email`, `role`, `staff_type`, `is_active`, `access_revoked`, `granted_overrides`, `denied_overrides`, `created_at`) in the caller's tenant |
| `get_permission_catalogue()` | Full Zeraki permission catalogue grouped by category |
| `get_roles_with_permissions()` | Built-in `GLOBAL` and tenant `CUSTOM` roles with member counts and permission arrays |
| `upsert_custom_role(...)` / `delete_custom_role(role_key)` | Create/update custom or global role permissions and delete unused custom roles |
| `get_user_permission_profile(user_id)` / `save_user_permission_overrides(...)` | Inspect and update per-user `GRANT` / `DENY` permission overrides |
| `set_user_access_revoked(user_id, revoked)` | Suspend or restore all effective permissions for an account |
| `invite_or_create_account(...)` / `update_account_profile(...)` | Provision new tenant accounts and update profile role, staff type, email, and active status |
| `get_section_heads()` / `upsert_section_head(...)` / `delete_section_head(...)` | List, assign, and remove section heads by form level |
| `get_exam_setup_options()` / `get_exam_pipeline_overview()` | Load school classes/streams/subjects and list all exams (`draft`/`review`/`reopened`/`published`) with mark-coverage counts |
| `create_exam(...)` | Create a `draft` exam and bind participating `exam_classes` |
| `get_exam_mark_entry_roster(...)` / `save_exam_subject_marks(...)` | Load student mark-entry sheet with preview grades and batch upsert/clear subject scores |
| `get_exam_publish_readiness(exam_id)` / `set_exam_lifecycle_status(exam_id, status)` | Inspect per-subject mark completion and transition exams between `draft`, `review`, `reopened`, and `published` |
| `get_grade_for_score(tenant_id, score, school_level, grade_level)` | Single source of truth for grade resolution |
| `log_message(...)` | Logs a sent SMS message with recipient type, message type, body, phone numbers, and count |
| `get_message_history(limit)` | Returns message history with sender name and exam name |
| `get_message_recipients()` | Returns students, teachers, classes, and streams for recipient selection |
| `get_pending_sms()` | Returns queued messages for the companion Android app to send via SmsManager |
| `update_sms_status(message_id, status)` | Updates message delivery status (queued/sent/delivered/failed/partial) |
| `get_sms_gateway_config()` | Returns SMS gateway configuration (device SIM, companion app info, permissions) |
All reporting functions:
- require the exam to be **published**;
- fail closed unless the caller's JWT `tenant_id` claim matches the exam's tenant (`Missing tenant claim`, `Access denied…`);
- allow an explicit `service_role` bypass (intended for server-side jobs);
- are `SECURITY INVOKER` (no `prosecdef`) with no `search_path` override;
- use `DENSE_RANK()` so tied means share a position.

The three parity RPCs added by `20261028000005_analytics_parity_rpcs.sql` follow the same rules and additionally `REVOKE ALL … FROM PUBLIC, anon` before granting `authenticated` and `service_role`, so anonymous callers never hold EXECUTE.

## Grading is configuration-driven

**Do not hardcode grade thresholds.** Grades are resolved by `get_grade_for_score`, which reads the tenant's active `grading_configurations` / `grading_configuration_levels`.

This matters because tenants differ. Verified live examples:

| Tenant | Level | EE | ME | AE | BE |
| --- | --- | --- | --- | --- | --- |
| `59556692…` | lower-primary | ≥ 76 | 50–75 | 26–49 | < 26 |
| `e2d776cf…` | upper-primary | ≥ 75 | 41–74.99 | 20–40.99 | < 20 |
| `c5cf9cf3…` | default (mode 8) | 90+ | 75–89 | 60–74 | … down to 0 |

Earlier documentation claimed `EE >= 75, ME 50–74, AE 40–49, BE < 40`. That was wrong for every tenant above.

`get_subject_performance` derives its four broad buckets from `get_grade_for_score(...)->broad`. All live `grading_configuration_levels.broad` values are exactly `EE`, `ME`, `AE`, `BE` (148 rows each). If a future configuration resolves a score to another or `NULL` broad code, the function raises a clear exception instead of returning columns that do not add up to `total_students`.

### Open product decision: pass mark

`pass_count` / `pass_rate` still use `score >= 40`. The schema has **no pass-mark column** — `grading_configuration_levels`, `report_grading_levels` and `report_template_configs` describe bands and points only. A configuration-derived pass mark would be a guess, so it was left unchanged. This needs a product decision before it is changed.

## Repository layout

Application:

- `src/app/analytics/page.tsx` — dashboard
- `src/app/analytics/report/[studentId]/page.tsx` — report card route
- `src/app/analytics/merit-list/page.tsx` — merit list / most improved
- `src/app/analytics/mark-sheet/page.tsx` — student × subject mark sheet
- `src/app/analytics/analysis/page.tsx` — analysis report
- `src/app/analytics/student/[studentId]/page.tsx` — student analytics
- `src/app/analytics/transcript/[studentId]/page.tsx` — printable transcript
- `src/app/analytics/report-forms/page.tsx` — class-level report forms generation with report type selector and print links
- `src/app/analytics/exams/page.tsx`, `src/app/analytics/exams/[examId]/page.tsx` — exam creation, subject mark entry, publish readiness, and flow to reports
- `src/app/analytics/accounts/page.tsx`, `src/app/analytics/accounts/[role]/page.tsx`, `src/app/analytics/accounts/[role]/user/[userId]/page.tsx` — accounts, roles, permissions & section heads
- `src/app/login/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css` — login, root layout, print CSS
- `src/components/analytics/` — table, chart, filter bar, summary cards, report card, merit list, mark sheet, class summary, analysis view, account directory (+ Vitest tests)
- `src/components/auth/` — `AuthGate`, login forms
- `src/lib/analytics/api.ts` — RPC callers, abort handling and `describeAnalyticsError()`
- `src/lib/analytics/guards.ts` — response validation and `AnalyticsContractError`
- `src/lib/analytics/types.ts` — response types
- `src/lib/analytics/markSheet.ts`, `analysis.ts`, `accounts.ts` — pure aggregation/improvement/role helpers
- `src/lib/analytics/filters.ts`, `format.ts`, `csv.ts` — pure helpers
- `src/lib/supabase/client.ts` — browser Supabase client from public env vars

Database and validation:

- `supabase/migrations/20261028000000_create_analytics_functions.sql` — baseline matching the functions currently live in production
- `supabase/migrations/20261028000001_fix_roster_joins_and_config_grading.sql` — **repository-only** correctness fixes (see below)
- `supabase/migrations/20261028000002_revoke_anon_execute_analytics.sql` — **PROPOSED, not applied**: removes anonymous EXECUTE (see hardening review)
- `supabase/migrations/20261028000003_fix_student_report_header.sql` — **PROPOSED, not applied**: authoritative enrollment for the report header (see below)
- `supabase/migrations/20261028000004_get_analytics_filters.sql` — filter options RPC
- `supabase/migrations/20261028000005_analytics_parity_rpcs.sql` — **repository-only**: `get_mark_sheet`, `get_student_exam_history`, `get_most_improved`
- `supabase/migrations/20261028000006_accounts_directory_rpc.sql` — **repository-only**: roles, permissions, accounts & section heads
- `supabase/migrations/20261028000007_exam_to_reports_pipeline.sql` — **repository-only**: exam creation, mark entry, publish readiness & lifecycle transitions
- `supabase/migrations/20261028000009_reports_full_parity.sql` — **repository-only**: term dates, subject paper breakdown, pathways & tracks, attendance, behaviour, CBC/assessment records, fee statements, report template configs
- `supabase/tests/analytics_tenant_isolation.sql` — primary security/correctness suite
- `supabase/tests/analytics_isolation_extra.sql` — authorization, grant, RLS and error-propagation suite
- `supabase/tests/join_multiplication_and_roster.sql` — 224-mark / enrollment-precedence / filtering / ranking regression
- `supabase/tests/grading_boundaries.sql` — band edges, config gaps, pass mark, broad-code reconciliation
- `supabase/tests/student_report_header.sql` — H1–H7 report-header enrollment precedence and ACL checks
- `supabase/tests/analytics_parity_rpcs.sql` — parity RPC grants, mark-sheet correctness, exam history/positions, most-improved selection, tenant isolation, `service_role` and `anon`
- `supabase/tests/accounts_directory_rpc.sql` — roles, permissions, user overrides, access revocation, account provisioning & section heads
- `supabase/tests/exam_to_reports_pipeline.sql` — end-to-end draft exam creation, teacher mark entry, publish readiness, publish -> reports verification, and reopen/re-publish flow
- `supabase/migrations/20261028000052_student_record_access.sql` — **repository-only**: registers 15 permission codes, `assert_student_access`, student record RPC guards
- `supabase/migrations/20261028000053_permission_foundation.sql` — **repository-only**: `assert_permission`, `get_my_permissions`, gated `link_parent_student`, audit insert lockdown
- `supabase/migrations/20261028000054_parent_admin_fixes.sql` — **repository-only**: fixes `get_parents` (column mismatch, role filter), gates `unlink_parent_student` and `get_parent_student_links`
- `supabase/migrations/20261028000055_parent_portal_reads.sql` — **repository-only**: `profiles.phone`, `assert_parent_of`, `get_my_children` and `get_my_child_*` reads, `parent_block` restrictive policies
- `supabase/tests/support/local_base_schema.sql` — **test-only** reconstruction of the base schema (not a migration)
- `supabase/tests/disposable/` — runnable `embedded-postgres` harness with the A/B demonstration, negative controls, rollback drill and captured evidence
- `supabase/tests/STAGING_VALIDATION_REPORT.md` — staging status, staged procedure, privilege review, migration-history plan
- `supabase/tests/PRODUCT_DECISIONS.md` — owner sign-off checklist (pass mark, hardening, report header)
- `supabase/tests/DEPLOYMENT_CHECKLIST.md` — eight required deployment gates
- `supabase/tests/ANALYTICS_COMPLETION_REPORT.md` — what was built, what was executed, and what remains blocked
- `supabase/tests/VALIDATION_HASHES.txt` — SHA-256 inventory of the validated files (append-only; run blocks at the end)

## Deployment status (read before deploying)

> **Runtime check, 2026-10-28 (read-only).** The currently configured project
> (`fzwexcgsyzdqyauwccah`) exposes **none** of the expected base tables
> (`tenants`, `schools`, `classes`, `streams`, `students`, `exams`) and **none**
> of the five analytics functions: PostgREST returns `PGRST205` / `PGRST202`.
> The project contains exactly **one** auth user. This contradicts the
> statement below that the functions are already live there. Either the
> environment points at a different (empty) project or that project was reset;
> this report does not guess which. Until this is resolved, the app cannot show
> analytics from this backend. See `reports/RUNTIME_TEST_REPORT.md`.

The five analytics functions were applied to project `fzwexcgsyzdqyauwccah` by **direct SQL**, and are **not present** in `supabase_migrations.schema_migrations`. The Supabase CLI is not linked for this environment (the account lacks the required privileges), so the migration workflow cannot be used yet.

- `20261028000000_create_analytics_functions.sql` is a repository copy of what is already live. It does not repair migration history.
- `20261028000001_fix_roster_joins_and_config_grading.sql` has **not been applied anywhere**. Applying it changes live function behaviour and is a separate deployment decision.
- `20261028000005_analytics_parity_rpcs.sql` adds three new functions and has **not been applied anywhere**. The app calls them; until the migration is applied to a real backend, the parity pages will show their error state.
- `20261028000006_accounts_directory_rpc.sql` adds `get_account_directory` and has **not been applied anywhere**. Until it is applied, `/analytics/accounts` will show its error state.

`20261028000001` fixes:

1. **Join multiplication in `get_class_performance`.** Marks were joined to both `exam_classes` and `student_enrollments` without restricting the join, so every mark was duplicated once per exam class. On exam `1dd32eb4-c3ea-4bc6-bb97-9008d54589a4` (9 `exam_classes`) a student with 224 raw marks was reported with a total of 2016 and a mean of 252%. Means above 100 then make `get_grade_for_score` raise `No grade level matches score …`. The fix aggregates marks before joining and resolves the latest enrollment with `DISTINCT ON`.
2. **Config-driven subject categories.** EE/ME/AE/BE counts now come from `get_grade_for_score` instead of the old hardcoded thresholds.

Unchanged intentionally in `20261028000001`: signatures, grants, `STABLE`, tenant guards, published-exam guards, the `score >= 40` pass mark, and `get_student_report_data` (its positions benefit from the fix above; the header source is handled separately by `20261028000003`).

Roster precedence for filters is `COALESCE(latest_enrollment.stream_id, students.stream_id)` (same for class), with the latest enrollment chosen by `academic_year DESC, created_at DESC`.

### Report header (`20261028000003`, proposed)

`20261028000003_fix_student_report_header.sql` replaces only `get_student_report_data`. It selects **one deterministic enrollment**, preferring the exam's academic year, then `academic_year DESC, created_at DESC, id DESC`, and falls back to `students.class_id` / `students.stream_id` only when the student has no enrollment. It also exposes `student.academic_year` (null when no enrollment exists) so the report can state which year the header describes.

Why: the previous body read `students.class_id` first and used an **unordered** `LIMIT 1` enrollment fallback, so a promoted/transferred student could show a stale class/stream and the fallback could vary between runs. Live data currently reports zero mismatches, but the inconsistency is real.

`CREATE OR REPLACE` keeps the signature, `json` return type, exam-wide position semantics, and existing ACLs. It is **repository-only and unapplied**; owner decision C in `PRODUCT_DECISIONS.md` remains open.

### Rollback

There is no down-migration. Because `20261028000000` is an exact repository copy of the currently live functions, the verified rollback is to re-apply it:

```sql
-- restores the previous function bodies; re-grants at the end of the file
\i supabase/migrations/20261028000000_create_analytics_functions.sql
```

This was drilled on the disposable database: after the fix returned 224 for the 224-mark fixture, re-applying the baseline returned 6048 again (the old inflated value) and kept `authenticated` / `service_role` grants.

Note the side effect: `20261028000000` starts with `DROP FUNCTION IF EXISTS` for all five functions, so a rollback drops and recreates every analytics function and re-grants them. It also reverts `000001` and `000003`, and reopens anonymous EXECUTE. The documented re-apply order after a rollback is:

1. `20261028000000` — baseline
2. `20261028000001` — roster/join and grading fixes
3. `20261028000002` — optional anon revoke, if it was in use
4. `20261028000003` — optional report header, if it was in use
5. `20261028000005` — parity RPCs
6. `20261028000006` — accounts directory RPC

This order is verified in the harness: `000001` keeps anon EXECUTE (`CREATE OR REPLACE` preserves ACLs), `000002` closes it, and `000003` keeps it closed. `000005` does not depend on the other fixes but must be re-applied after any `DROP FUNCTION` rollback that targets its three functions. None of this touches `supabase_migrations.schema_migrations`.

### Future production reconciliation (not executed)

The five functions are live but absent from migration history, so `supabase db push` would try to run `20261028000000` (dropping and recreating them) and then `20261028000001`. The safest sequence, once CLI access exists, is a reviewed manual deployment: apply `20261028000001` directly, verify results, and only then decide — with the project owner — whether to mark `20261028000000` as applied. Do **not** insert fake migration-history rows.

### Staging validation status: BLOCKED

Real-schema staging validation has **not** been performed. No authorized TUSOME staging project is reachable from this environment:

- The Supabase CLI is authenticated, but its project list contains only `E-REPORTS` (active) and `V2p` (inactive). Neither is TUSOME, and production `fzwexcgsz…` is not accessible to this account.
- `env.local` contains exactly one `SUPABASE_URL`, and it resolves to the production project ref. There is no staging URL or staging key.
- There is no `supabase/config.toml`, no linked project, and no Docker/Podman, so no local Supabase stack exists (`supabase status` fails).
- Production was not contacted, and must not be used as the test environment.

The full runbook, required approvals, and the checks staging must add (real constraints/triggers/RLS/grants plus live-data reconciliation) are in `supabase/tests/STAGING_VALIDATION_REPORT.md`.

### Pass-mark decision (open product question)

`score >= 40` is still the pass rule, hardcoded in `get_class_performance`/`get_subject_performance` (and in the baseline `get_grade_distribution`). The schema has no pass-mark column or setting. This is documented as an **open product decision requiring owner confirmation**; the pass mark was not changed and no column was added.

### Anonymous EXECUTE (proposed hardening, not applied)

Both deployed migrations `GRANT` but never `REVOKE` PostgreSQL's default `EXECUTE … TO PUBLIC`, so `anon` also holds EXECUTE (measured on the disposable schema; production ACLs still need the pre-flight check in the report). Anonymous calls still fail closed (`Missing tenant claim`), and no intended flow uses these RPCs anonymously. `20261028000002_revoke_anon_execute_analytics.sql` proposes the narrowest fix (`REVOKE … FROM PUBLIC, anon`, re-assert `authenticated`/`service_role`). It was validated on disposable PostgreSQL 17 - anon loses EXECUTE, PUBLIC no longer grants, both supported roles keep access, all suites still pass, and the change is reversible. **It has not been applied to any database.** Re-applying `20261028000000` recreates the functions with the default PUBLIC grant, so `20261028000002` must be re-applied after any such rollback.

## Tests

All six SQL suites must run against a **local or disposable** database, after the analytics migrations are applied. They insert tenants, exams, students and marks, run in a single transaction, and roll back. **Never run them against production.**

```bash
# local Supabase
supabase db reset
for f in supabase/tests/analytics_tenant_isolation.sql \
         supabase/tests/analytics_isolation_extra.sql \
         supabase/tests/join_multiplication_and_roster.sql \
         supabase/tests/grading_boundaries.sql \
         supabase/tests/student_report_header.sql \
         supabase/tests/analytics_parity_rpcs.sql; do
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

The repository does not contain the base application schema, so `supabase/tests/support/local_base_schema.sql` reconstructs the minimum objects the migrations depend on (roles, `auth` helpers, 12 tables, RLS policies, the published-exam marks guard, grants). It is **test-only**: it is not a migration, it creates no `supabase_migrations` rows, and it must never be applied to a real project.

The reproducible alternative — no Docker, no system PostgreSQL, no `psql` — is the harness in `supabase/tests/disposable/` (see its README):

```bash
cd supabase/tests/disposable
npm install
npm test
```

It creates its own local cluster, applies the baseline, the correctness fix, the proposed anon revoke, the proposed report-header migration and the parity RPCs, runs the six suites, the negative controls, the tie-break control, the rollback drill and the rollback-order checks, and exits non-zero on any failure. `supabase/tests/disposable/evidence-2026-10-31-parity.log` captures the latest run (**76 PASS checks, 0 FAIL, 5 EVIDENCE**); `evidence-2026-10-28-run4.log` is the earlier 73-PASS run, `evidence-2026-10-28-run2.log` the 52-PASS run and `evidence-2026-10-28.log` the first (48 PASS). `evidence-2026-10-28-run3.log` is a failed start (data directory pre-created) and is not evidence of a passing run.

### Application and browser tests

```bash
npm test              # 123 unit/component tests
npm run typecheck
npm run lint
npm run build

npm run dev           # keep running in another terminal
npm run test:e2e      # Playwright, Microsoft Edge
```

Authenticated E2E checks are skipped unless `E2E_EMAIL` and `E2E_PASSWORD` are
exported in the shell for an authorised account. Credentials are never read from
the repository and never written to reports. Set `E2E_BASE_URL` to test a
deployed URL. The config uses `channel: 'msedge'` because the bundled Playwright
browser version on this machine does not match the pinned package.

`reports/browser-test.cjs` is the broader runtime probe (anonymous access,
invalid credentials, owner sign-in, backend readiness, retry, tampered session)
and writes `reports/browser-results.json` plus screenshots.

### Last executed result (disposable PostgreSQL 17, 2026-10-28)

Run against a throwaway `embedded-postgres@17.10.0-beta.17` cluster on `127.0.0.1` with a freshly initialised data directory. Production was never contacted. Run 4 used port 55462 and covers `000000` → `000001` → `000002` → `000003`, the five suites, and rollback/re-apply order.

| Check | Result |
| --- | --- |
| base schema + migration `20261028000000` | PASS |
| migration `20261028000001` | PASS |
| `20261028000001` re-applied (idempotency) | PASS |
| signature / owner / `prosecdef=false` / `provolatile='s'` preserved | PASS |
| join multiplication: 224 marks | PASS — baseline **2016** (1 enrollment) and **6048** (3 enrollments); fixed **224**, 1 row, 224 subjects |
| `join_multiplication_and_roster.sql` | PASS |
| `grading_boundaries.sql` | PASS |
| `analytics_tenant_isolation.sql` | PASS |
| `analytics_isolation_extra.sql` | PASS |
| `student_report_header.sql` (H1–H7) | PASS |
| negative control: join suite on baseline | PASS (fails as expected: `No grade level matches score 900.00`) |
| negative control: grading suite on baseline | PASS (fails as expected: `FAIL broad counts: EE=2 ME=1 AE=0 BE=1`) |
| negative control: primary suite on baseline | PASS (fails as expected: `No grade level matches score 150.00`) |
| negative control: same-year tie-break reversed (`created_at ASC`) | PASS (fails as expected: `FAIL same-year tie-break: Class 8 filter returned <no row>`) |
| authorization-only suite on baseline | PASS (same result as with the fix: no auth regression) |
| rollback drill (re-apply baseline) | PASS (6048 restored, grants kept) |
| suites leave no rows behind | PASS |
| `20261028000002` anon revoke (proposed) | PASS — anon EXECUTE true → false, PUBLIC no longer grants, `authenticated`/`service_role` keep EXECUTE |
| `20261028000002` idempotency + suites | PASS — re-apply is a no-op, all suites still pass |
| `20261028000002` anon call | PASS — `permission denied for function get_class_performance` |
| `20261028000002` rollback | PASS — `GRANT … TO PUBLIC` restores anon; re-apply closes it again |
| `20261028000002` rollback order | PASS — re-applying `20261028000000` recreates the functions and restores anon EXECUTE; `000001` preserves it; `000002` closes it again |
| `20261028000003` applied over the hardening | PASS — signature/return type unchanged, anon still blocked |
| `20261028000003` header checks (H1–H7) | PASS — exam-year enrollment wins, marks not duplicated, no-enrollment fallback, latest-enrollment fallback, same-year `created_at` tie-break, identity from `students`, `authenticated` keeps EXECUTE |
| `20261028000003` after rollback + re-apply order | PASS — `000000` → `000001` → `000002` → `000003` restores header behaviour and keeps anon blocked |

Covered: non-inflated totals, latest-enrollment precedence (including the same-academic-year `created_at` tie-break), no-enrollment and NULL-stream fallback, non-`exam_classes` classes, class/stream-filtered ranking, `DENSE_RANK` ties, inclusive band edges (0 / 29.99 / 30 / 59.99 / 60 / 79.99 / 80 / 100), configuration gaps, inactive decoys, alternate tenant scales, missing/empty configuration, unsupported and `NULL` broad codes, two-decimal rounding, unchanged `score >= 40` pass mark, valid/missing/malformed/mismatched tenant claims, draft exams, missing exams, cross-tenant student and exam reports, RLS filtering, the intended `service_role` bypass, and report-header enrollment precedence/ACL preservation.

### Parity RPC verification (disposable PostgreSQL 17, 2026-10-31)

The full harness was re-run after adding `20261028000005`, `20261028000006`, `20261028000007`, `analytics_parity_rpcs.sql`, `accounts_directory_rpc.sql`, and `exam_to_reports_pipeline.sql`: **82 PASS, 0 FAIL, 5 EVIDENCE** (`supabase/tests/disposable/evidence-2026-10-31-parity.log`).

| Check | Result |
| --- | --- |
| migration `20261028000005` applied | PASS |
| migration `20261028000006` applied | PASS |
| parity function count / `SECURITY INVOKER` / `STABLE` / grants | PASS — `anon` has no EXECUTE; `authenticated` + `service_role` do |
| mark sheet matrix and filters | PASS — latest enrollment wins over stale `students.class_id`; class/stream filters; draft and unknown exams rejected |
| mark sheet grades | PASS — resolved through `get_grade_for_score` against a non-standard config |
| exam history ordering and means | PASS — published only, newest first, totals/means/subject counts |
| exam history grades and positions | PASS — configured overall grade and `DENSE_RANK` position of the exam cohort |
| most improved selection | PASS — current vs previous published exam, class filter, same-year `created_at`/id tie-break |
| account directory (`get_account_directory`) | PASS — tenant-scoped (RLS and explicit guard as owner), ordered by name, preserves nullable `full_name`/`role` and `is_active`, `service_role` bypass, `anon` blocked |
| cross-tenant calls (explicit guard, RLS bypassed) | PASS — `Access denied…` for student and exam |
| cross-tenant calls as `authenticated` (RLS) | PASS — `Student not found` / `Exam not found` |
| missing / malformed tenant claim | PASS — `Missing tenant claim` |
| `service_role` bypass | PASS — reads another tenant's fixtures |
| `anon` | PASS — `permission denied for function get_mark_sheet` / `get_account_directory` |
| negative control without `20261028000005` | PASS (fails as expected: `FAIL grants: expected 3 parity functions`) |
| negative control without `20261028000006` | PASS (fails as expected: `FAIL grants: expected 1 account directory function`) |
| harness rerun without deleting the data directory | PASS — `freshDb` recreates a database left behind by a Windows `EBUSY` cleanup |

### Application verification (executed locally)

| Check | Command | Result |
| --- | --- | --- |
| dependency install | `npm install` | PASS — 532 packages, Node v24.19.0 / npm 11.17.0 |
| unit/component tests | `npm test` | PASS — 145 tests, 13 files, exit 0 |
| typecheck | `npm run typecheck` | PASS — exit 0 |
| lint | `npm run lint` | PASS — no warnings or errors, exit 0 |
| production build | `npm run build` | PASS — Next.js 14.2.35, routes `/`, `/analytics`, `/analytics/exams`, `/analytics/exams/[examId]`, `/analytics/accounts`, `/analytics/accounts/[role]`, `/analytics/accounts/[role]/user/[userId]`, `/analytics/merit-list`, `/analytics/mark-sheet`, `/analytics/analysis`, `/analytics/report-forms`, `/analytics/report/[studentId]`, `/analytics/student/[studentId]`, `/analytics/transcript/[studentId]`, `/login` |
| dev server | `npm run dev` | PASS — HTTP 200 on `http://localhost:3000` |
| browser E2E (anonymous + owner) | `npm run test:e2e` | PASS — 5/5 Playwright tests in Edge |
| runtime browser probe | `node reports/browser-test.cjs` | PASS — 22 PASS / 0 FAIL / 3 INFO |
| dashboard data with a real tenant | — | BLOCKED EXTERNAL — configured project has no tables or functions |

These checks use the reconstructed app manifest and config in this workspace. They do not prove behaviour against the production Supabase schema; that requires Gate 2/3 staging access.

### Runtime verification (2026-10-28)

- The owner account authenticates successfully, persists across reload, and can sign out; the gate closes protected routes again afterwards.
- The dashboard shell and all four filters render. With the backend undeployed it shows “Could not load filters / Could not load exams, classes and streams.”, offers Retry, and shows **zero** rows rather than fabricated data.
- Principal and teacher accounts **do not exist** in the configured project (verified by a read-only admin user listing), so those sign-ins correctly return the generic error.
- The owner JWT has **no `tenant_id`** claim, so analytics RPCs would fail closed with `Missing tenant claim` even after the schema is restored.
- The owner account must sign in with `E2E_EMAIL` / `E2E_PASSWORD` set in the environment; credentials are never stored in the repository.

Full evidence: `reports/RUNTIME_TEST_REPORT.md` and `reports/browser-results.json`.

### Known hardening item (proposed, not applied)

The migrations `GRANT EXECUTE` but never `REVOKE` the PostgreSQL default `EXECUTE … TO PUBLIC`, so `anon` also holds the privilege on all five functions. `anon` still cannot read anything: every RPC raises `Missing tenant claim` because an anon JWT carries no `tenant_id`. The tests assert that fail-closed behaviour rather than the privilege itself. `20261028000002_revoke_anon_execute_analytics.sql` proposes `REVOKE EXECUTE … FROM PUBLIC, anon` as defense in depth; it is validated on disposable PostgreSQL but **not applied**, and awaits the decision in `supabase/tests/PRODUCT_DECISIONS.md` (item B).

## Parity scope: implemented vs blocked

Implemented using only the existing schema:

| Zeraki surface | Evidence in the APK bundle | TUSOME implementation |
| --- | --- | --- |
| Mark list / mark sheet | `printouts/mark-list`, `chunk-Z2GYXG2A.js` (`downloadMarkList`, "All Papers") | `/analytics/mark-sheet`, `get_mark_sheet` |
| Merit list / most improved | `printouts/merit-list`, `chunk-FRJZU4QD.js` ("Merit List", "Most Improved", `classGradeSummary`) | `/analytics/merit-list`, `get_most_improved`, `MeritListTable` |
| Analysis report | `printouts/analysis-report`, `chunk-Q4FKRZWB.js` (`analysisReport`) | `/analytics/analysis`, `AnalysisReportView` |
| Student analytics / previous-exam comparison | `students/:id/analytics`, `chunk-P55HMAPS.js` (`compare-by-previous-exam`, `performanceOverTimeChartOptions`) | `/analytics/student/[studentId]`, `get_student_exam_history` |
| Transcripts | `printouts/transcripts`, `chunk-67MEQ2KN.js` (`transcripts`) | `/analytics/transcript/[studentId]` |
| Report Forms | `printouts/reportForms`, `chunk-GE7RWLIH.js` (`reportForms`, `ReportFormsComponent`, `reportType`: `examOnly` / `evaluationsAndExams` / `SUMMARY_REPORT`, `rForm.reportFormsBtn`) | `/analytics/report-forms`, `/analytics/report/[studentId]` |
| User roles, custom roles & permission catalogue | `settings/usr-roles`, `chunk-DTRKVYAB.js`, `chunk-XOUYY76Z.js`, `chunk-YXB57XCL.js`, `chunk-4ELYURC5.js` | `/analytics/accounts`, `/analytics/accounts/[role]`, `permissions`, `roles`, `role_permissions`, `get_permission_catalogue`, `get_roles_with_permissions`, `upsert_custom_role`, `delete_custom_role` |
| Per-user permission overrides & access revocation | `chunk-XOUYY76Z.js` (`UserPermissionsComponent`, `Granted`/`Eligible`/`Restricted`, `revokeAllAccess`, `restoreAccess`) | `/analytics/accounts/[role]/user/[userId]`, `user_permissions`, `get_user_permission_profile`, `save_user_permission_overrides`, `set_user_access_revoked` |
| Account provisioning, role editing, staff types & emails | `chunk-XOUYY76Z.js` (`Fe`: `TEACHER`/`OFFICIAL`/`WORKER`), `chunk-UYYCA7BM.js` | `profiles.email`, `profiles.staff_type`, `profiles.access_revoked`, admin RLS write policies, `invite_or_create_account`, `update_account_profile` |
| Section heads | `settings/section-heads`, `chunk-POC2O2ZL.js` (`SectionHeadsComponent`, `Te` form levels) | `/analytics/accounts` (Section Heads tab), `section_heads`, `get_section_heads`, `upsert_section_head`, `delete_section_head` |
| Exam creation, mark entry, publish readiness & flow to reports | `exams/create-exam` (`chunk-HTDCN6NT.js`), `exams/my-classes` (`chunk-AMVB26KM.js`), `exams/manage` (`chunk-372RFQAZ.js`), `publish/status` (`chunk-RMCHKSBZ.js`), `publish` (`chunk-E2VI6NTQ.js`) | `/analytics/exams`, `/analytics/exams/[examId]`, `create_exam`, `get_exam_mark_entry_roster`, `save_exam_subject_marks`, `get_exam_publish_readiness`, `set_exam_lifecycle_status` |

**Not implemented — the schema cannot support them.** These are documented as blocked rather than faked:

| Zeraki feature | Why it is blocked |
| --- | --- |
| KCPE marks (`showKcpeMarks`) | No KCPE table, columns or import path in the schema. |
| Paper-level breakdown ("All Papers", `showSubjectPapers`) | `marks` stores one score per student × subject per exam; there is no paper/component table. |
| Targets | No target, projection or goal table/column. |
| Pathways | No pathway table or student pathway column. |
| CBC / assessment records | No competency, strand, sub-strand or assessment tables. |
| Attendance | No attendance table. |
| Report templates | `report_template_configs` / `report_grading_levels` describe bands and points only; there is no print-layout storage used by the app, and the report card is rendered in code. A template editor needs new schema and a product decision. |

If any of these become real requirements, they need schema additions and a product decision first; the UI must not invent the data.

## Reference comparison (Zeraki APK 4.3.25)

Verified from the bundled web app:
- Four expectation levels: Exceeding / Meeting / Approaching / Below Expectations (EE/ME/AE/BE).
- Grade breakdown, grade summary, class grade summary, merit list, mark sheet, and print/PDF output exist.
- Ranking criteria include "Rank by Mean marks", matching the mean-based `DENSE_RANK()` here.
- "No published exams" and "No Assessments Found" empty states exist.

Not verifiable from the APK and therefore **not claimed as parity**:
- Whether the reference's report-card position is scoped to the class/stream or the whole exam. TUSOME uses the whole exam because `get_student_report_data` calls `get_class_performance(p_exam_id)` without a class/stream argument and `total_in_class` is that same result set.
- The reference's exact retry/error UX (the retry control here is a reliability addition, not a copied behaviour).

## Notes

- Functions use the live schema: `students.admission_no` / `full_name`, `marks.score`, `exam_classes`, `student_enrollments`.
- The dashboard "Class Mean" is the unweighted mean of student means; "Highest Mean" is the highest student mean.
- Grade-distribution percentages are rounded to one decimal place.
- `marks.score` is currently integer 0–100 for all 11,169 rows; `get_grade_for_score` matches bands inclusively, so non-integer scores could land in configuration gaps and raise.
