# TUSOME Analytics — Completion Report

Date: 2026-10-28
Workspace: `C:\Users\brian\Videos\TUSOME`
Production contacted: **No**
Production changed: **No**
Git repository: **None** (SHA-256 inventory in `VALIDATION_HASHES.txt` is the change record)

This report separates work that was actually executed from work that remains
blocked. Only checks with captured output are marked PASS.

---

## 1. What was delivered

### 1.1 Application (reconstructed and implemented)

The workspace contained analytics SQL, tests and fragments of UI code, but no
`package.json`, lockfile, Next.js config, TypeScript config, Tailwind/PostCSS
config, test runner, or Supabase browser client. Those were rebuilt, and the
dashboard/report app was implemented rather than left as a scratch harness.

| Area | Files |
| --- | --- |
| Project tooling | `package.json`, `package-lock.json`, `next.config.mjs`, `tsconfig.json`, `postcss.config.mjs`, `tailwind.config.ts`, `.eslintrc.json`, `vitest.config.ts`, `vitest.setup.ts`, `.env.example`, `.gitignore` |
| App shell | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/error.tsx`, `src/app/loading.tsx`, `src/app/not-found.tsx` |
| Auth | `src/components/auth/AuthGate.tsx`, `src/components/auth/LoginForm.tsx`, `src/components/auth/SearchParamsLoginForm.tsx`, `src/app/login/page.tsx` |
| Dashboard | `src/app/analytics/layout.tsx`, `src/app/analytics/page.tsx`, `src/components/analytics/FilterBar.tsx`, `SummaryCards.tsx`, `GradeDistributionChart.tsx`, `SubjectPerformanceTable.tsx`, `ClassPerformanceTable.tsx` |
| Report card | `src/app/analytics/report/[studentId]/page.tsx`, `src/components/analytics/StudentReportCard.tsx` |
| Data layer | `src/lib/supabase/client.ts`, `src/lib/analytics/api.ts`, `guards.ts`, `types.ts`, `filters.ts`, `format.ts`, `csv.ts` |
| UI primitives | `src/components/ui.tsx` |
| Tests | 9 Vitest files alongside the modules above |

Behaviour implemented:

- Academic-year → exam → class → stream filter cascade; filter options reload on refresh.
- Five RPCs called through a single guarded client (`get_class_performance`,
  `get_grade_distribution`, `get_subject_performance`,
  `get_student_report_data`, `get_grade_for_score` via the RPCs).
- Response validation (`AnalyticsContractError`) so a malformed payload shows an
  error instead of a half-rendered dashboard.
- Abort handling on unmount/filter change, with stale results cleared.
- Loading, empty, and retryable error states for both filter and analytics loads.
- CSV export of class performance.
- Printable report card with **Print / Save as PDF**, hidden navigation in print,
  exam-wide position labelled as such, and academic year from enrollment.
- Client-side Supabase auth gate and `/login`; only public env vars are used.
- Accessible tables (`caption`, `scope`, row headers) and keyboard-reachable controls.

### 1.2 Database migrations

| Migration | Status | Purpose |
| --- | --- | --- |
| `20261028000000_create_analytics_functions.sql` | Unchanged baseline | Matches the functions currently live in production |
| `20261028000001_fix_roster_joins_and_config_grading.sql` | Unapplied, validated | Fixes join multiplication (2016/6048 → 224) and config-driven broad grades |
| `20261028000002_revoke_anon_execute_analytics.sql` | Unapplied, proposed | Revokes inherited anon/PUBLIC EXECUTE; re-asserts authenticated/service_role |
| `20261028000003_fix_student_report_header.sql` | Unapplied, proposed | Deterministic enrollment-based report header; exposes `student.academic_year` |

`000003` was added because the existing `get_student_report_data` preferred
`students.class_id` / `students.stream_id` and used an unordered enrollment
fallback. It uses `CREATE OR REPLACE`, so signature, return type, exam-wide
position semantics, and ACLs are preserved. No pass mark was changed.

### 1.3 Test suites

| Suite | Coverage |
| --- | --- |
| `analytics_tenant_isolation.sql` | Primary security/correctness, tenant and cross-tenant guards, published-exam guards |
| `analytics_isolation_extra.sql` | Authorization, grants, RLS, error propagation, service-role bypass |
| `join_multiplication_and_roster.sql` | 224-mark regression, enrollment precedence, filtering, ranking |
| `grading_boundaries.sql` | Band edges, config gaps, broad-code reconciliation, unchanged pass mark |
| `student_report_header.sql` | H1–H7 header precedence, mark duplication, identity, ACL |

The disposable harness (`supabase/tests/disposable/run.mjs`) runs all five
suites plus the A/B demonstration, negative controls, tie-break control,
rollback drill, and rollback/re-apply order.

---

## 2. Executed verification (PASS)

All results below were produced locally on 2026-10-28.

### 2.1 Disposable PostgreSQL 17 harness

Command (fresh data directory, non-default port, temp `node_modules` junction):

```powershell
$env:TUSOME_TEST_PGDATA='<fresh temp dir>'
$env:TUSOME_TEST_PGPORT='55462'
$env:TUSOME_REPO='C:\Users\brian\Videos\TUSOME'
npm test
```

Result: **73 unique PASS checks, 0 FAIL, 5 EVIDENCE, exit 0**
Evidence: `supabase/tests/disposable/evidence-2026-10-28-run4.log` (the log
prints each result in the console transcript and again in a summary block, so
raw matching lines double).

Highlights from the log:

- Baseline reproduces the defect: 2016 for one enrollment, 6048 for three.
- Fixed function returns 224 marks in 1 row with 224 subjects.
- All five suites pass with the fixes applied.
- Negative controls fail on the baseline for the expected reasons.
- `000002` closes anon EXECUTE; `authenticated` / `service_role` keep access.
- Rollback recreates the baseline and reopens anon EXECUTE; the documented
  `000000 → 000001 → 000002 → 000003` order restores both behaviour and ACL state.
- `000003` header checks pass after rollback and re-apply.

### 2.2 Application checks

| Command | Result | Evidence |
| --- | --- | --- |
| `npm install` | PASS — 532 packages | Node v24.19.0, npm 11.17.0 |
| `npm test` | PASS — 88 tests in 9 files, exit 0 | Vitest 3.2.7 |
| `npm run typecheck` | PASS — exit 0 | `tsc --noEmit`, strict |
| `npm run lint` | PASS — no warnings or errors, exit 0 | `next lint` |
| `npm run build` | PASS — exit 0 | Next.js 14.2.35; `/`, `/analytics`, `/analytics/report/[studentId]`, `/login` |
| `npm run dev` | PASS — HTTP 200 | `http://localhost:3000`, ready in 1284 ms |
| `npm run test:e2e` | PASS — 5/5 | Playwright + Microsoft Edge |
| `node reports/browser-test.cjs` | PASS — 22 / 0 / 3 | `reports/browser-results.json` |

The build used `.env.local` for public Supabase configuration. No secret value
was printed or written into any report.

### 2.3 Runtime and authenticated browser verification

Executed on 2026-10-28 against the configured project. Evidence:
`reports/RUNTIME_TEST_REPORT.md`, `reports/browser-results.json`,
`reports/screenshots/`.

- Homepage redirects to `/login?next=%2Fanalytics`; anonymous dashboard and
  report-card routes redirect with `next` preserved.
- Invalid credentials return the generic "Email or password is incorrect."
- The owner account signs in, survives reload, and signs out; protected routes
  close again. A tampered/expired persisted session is rejected.
- The dashboard shell and four filters render, then show a recoverable error
  banner with Retry because the backend returns `PGRST205` / `PGRST202`.
- Principal and teacher users **do not exist** in the project (read-only admin
  listing), so no account could be created without writing to production.
- The owner JWT has no `tenant_id` claim, so RPCs would fail closed with
  `Missing tenant claim` once the schema is present.
- The configured project exposes **no** TUSOME base tables and **no** analytics
  functions, contradicting the earlier claim that the functions are live there.

---

## 3. Not run / blocked external

These are **not** PASS. They require access or artifacts this environment does
not have.

| Item | Status | Why |
| --- | --- | --- |
| Real-schema staging validation | BLOCKED EXTERNAL | No authorized TUSOME staging project. The CLI account sees only `E-REPORTS` and `V2p`; `env.local` points at production; no `config.toml`, no linked project, no Docker/Podman |
| Production deployment | BLOCKED EXTERNAL | Not authorized; production ref not reachable from this account; Gates 1–8 incomplete |
| Analytics data with a real tenant | BLOCKED EXTERNAL | The configured project has no base tables (`PGRST205`), no analytics functions (`PGRST202`), and only one auth user. Owner JWT also lacks `tenant_id` |
| Browser E2E with a principal/teacher user | BLOCKED EXTERNAL | Both users are absent from the project; creating them there is prohibited. Owner E2E runs and passes |
| Live pre-change function/ACL capture | NOT RUN | Requires production read access under Gate 5; deliberately not attempted |
| Independent four-eyes review | NOT RUN | No second reviewer available |
| Owner sign-off A/B/C | OUTSTANDING | `PRODUCT_DECISIONS.md` unsigned |
| `20261028000002` / `000003` deployment | NOT APPLIED | Proposed only; owner approval and staging gates required |

`evidence-2026-10-28-run3.log` documents a failed harness start (data directory
pre-created). It is kept for traceability but is not evidence of success.

---

## 4. Data-integrity and safety guarantees

- No production statement was executed: no DDL, DML, grant change, migration
  repair, history insert, or `db push`.
- No `supabase_migrations.schema_migrations` row was created or modified.
- No credentials or student records are included in this report or the evidence
  logs. Fixtures are synthetic UUIDs.
- `000003` is `CREATE OR REPLACE` only and preserves revoked ACLs (proven in run 4).
- Validated files were not edited except where a demonstrated defect required a
  new migration or harness fix; fixes are recorded in the hash inventory.

---

## 5. Assumptions and open decisions

1. **Pass mark is `score >= 40`.** No authoritative configurable pass mark exists
   in the schema. Dashboard copy states the assumption. Owner decision A remains
   open; changing it needs a new migration and tests.
2. **Report position is exam-wide.** This preserves existing function and suite
   semantics; the UI states it explicitly.
3. **Enrollment is authoritative for the report header.** Implemented in the
   proposed `000003`; owner decision C remains open.
4. **Anonymous EXECUTE hardening is defence in depth.** Calls already fail
   closed without a tenant claim. Owner decision B remains open.

---

## 6. How to proceed

1. Owner signs A, B and C in `PRODUCT_DECISIONS.md`.
2. Provision an authorized TUSOME staging project and complete Gates 2–3 in
   `DEPLOYMENT_CHECKLIST.md` (read-only pre-flight, diff review, real-schema
   suites, rollback drill).
3. Run browser E2E against staging with a real tenant user, including expired
   session, unpublished exam and cross-tenant report.
4. Obtain written deployment authorization (Gate 8), then deploy in the
   documented order `000000 → 000001 → 000002 → 000003` inside a transaction
   with in-transaction verification.
5. Record the change out-of-band. Do not write migration-history rows.

Until steps 1–4 complete, the correct status is **not ready for production**,
even though the local build and disposable-database evidence pass.
