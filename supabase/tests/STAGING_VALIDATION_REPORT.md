# TUSOME Analytics — Staging Validation Report

Date: 2026-10-28
Scope: repository changes for `20261028000001` (correctness fix), proposed `20261028000002` (grant hardening), proposed `20261028000003` (report header), and preparation of real-schema staging validation.
Production changes made in this task: **none**.

Final status: **BLOCKED** (staging unavailable; product approvals outstanding). The repository change itself remains **READY FOR REVIEW — NOT APPROVED FOR PRODUCTION DEPLOYMENT**.

---

## 1. Staging environment and schema status

**Finding: no authorized TUSOME staging database is available. Real-schema staging validation is BLOCKED.**

Evidence collected (no secret values read or printed):

| Probe | Result |
| --- | --- |
| Supabase CLI | 2.117.0, authenticated |
| Organizations | one: `brianmutundi's Org` |
| Accessible projects | `E-REPORTS` (`oakznwbqzcbxzkemvoce`, ACTIVE_HEALTHY, eu-west-1) and `V2p` (`ccrxdauvjoqeyotawwvx`, INACTIVE, eu-west-3) |
| TUSOME staging project | none in the accessible project list |
| Production project | `fzwexcgsyzdqyauwccah` is **not** in the accessible project list |
| Repository link | no `supabase/config.toml`, no `supabase/.temp/project-ref`, no linked project |
| Local stack | no Docker/Podman; `supabase status` → `docker: command not found (podman also not found)` |
| `env.local` | exactly one `SUPABASE_URL`; it resolves to the **production** project ref. No staging URL, no staging keys |

Conclusions:

- The only TUSOME database reachable by configuration is production. It was not contacted and must not be used as a test environment.
- `E-REPORTS` and `V2p` are unrelated projects under the same org. Nothing in the repository authorizes using them as TUSOME staging, and their schemas are not known to match production.
- Consequently the disposable PostgreSQL 17 results stand as the only executed evidence. They are strong evidence of function correctness but **not** proof against the real schema.

### What staging must verify that the disposable shim cannot

1. **Real schema objects**: constraints, defaults, enum/domain types, indexes, triggers (especially the published-exam marks guard), RLS policies on `marks`, `exams`, `students`, `student_enrollments`, `grading_configuration*`, and the real definitions of `auth.jwt()`, `auth.role()`, `public.my_tenant_id()`, `public.is_admin()`.
2. **Real privileges**: actual `proacl`, schema-level grants, default privileges, role memberships, and whether `anon`/`authenticated`/`service_role` differ from the shim.
3. **Real data**: the reported 224-mark exam (`1dd32eb4-c3ea-4bc6-bb97-9008d54589a4`) must return 224 after the fix (not 2016), and per-student totals/means must reconcile with raw marks.
4. **Real tenant grading configuration**: all school levels/modes used by live tenants, including gaps and NULL broad codes.
5. **Real concurrency/locking**: `CREATE OR REPLACE FUNCTION` takes a brief lock; check deploy window behaviour against live dashboard traffic.

### Required staging runbook (execute only after explicit owner authorization)

```bash
# 0. Guard: refuse anything that is not a dedicated staging project.
#    Never substitute the production ref. Values belong in the operator shell,
#    never in this repository.
test -n "$STAGING_PROJECT_REF" || { echo "STAGING_PROJECT_REF missing"; exit 1; }
test "$STAGING_PROJECT_REF" != "fzwexcgsyzdqyauwccah" || { echo "refusing production"; exit 1; }
test -n "$STAGING_DB_URL" || { echo "STAGING_DB_URL missing"; exit 1; }
```

Step map — every step is labelled **read-only** or **mutating** so the operator
never mixes them:

| # | Step | Mode | Output to keep |
| --- | --- | --- | --- |
| 1 | Confirm project identity: `supabase projects list` (or `projects list --output json`), match ref/org/region against the written authorization; guard above; `select current_database(), version()` | read-only | identity capture with timestamp |
| 2 | Capture functions, ACLs, owner, triggers, policies, roles, `schema_migrations` (queries below) | read-only | pre-change baseline |
| 3 | Normalised diff of `pg_get_functiondef()` vs `20261028000000`; stop if different | read-only | diff + decision |
| 4 | Apply `20261028000001` in a transaction (and `20261028000002` only if approved) | **mutating** | transaction log |
| 5 | Post-deploy verification inside the transaction | read-only | query output |
| 6 | `COMMIT` only if step 5 passes, else `ROLLBACK` | **mutating** | commit/rollback record |
| 7 | Fixture suites (inserts + `ROLLBACK`), only with owner consent | **mutating (rolled back)** | suite output |
| 8 | Rollback drill on a clone, not on staging after sign-off | **mutating** | drill output |

Pre-flight identity and capture, read-only (record output as the staging baseline):

```sql
select version();
select proname, pg_get_function_identity_arguments(oid) as args, prosecdef,
       provolatile, proowner::regrole as owner, proacl
from pg_proc
where proname in ('get_grade_for_score','get_class_performance',
                  'get_grade_distribution','get_student_report_data','get_subject_performance');

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname in ('public','auth');

select tgname, tgrelid::regclass as tbl, tgenabled
from pg_trigger where not tgisinternal;

select rolname from pg_roles
where rolname in ('anon','authenticated','service_role','postgres','supabase_admin');

select has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'get\_%';

select * from supabase_migrations.schema_migrations order by version;

-- Step 3: capture definitions for a normalised diff against 20261028000000.
-- Store raw output; do not edit the baseline to make the diff pass.
select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_grade_for_score','get_class_performance',
                    'get_grade_distribution','get_student_report_data','get_subject_performance')
order by p.proname;
```

Deploy in order, in a single transaction, in an owner-approved window. `000002`
is included **only if approved** (see `PRODUCT_DECISIONS.md`); skipping it leaves
anonymous EXECUTE in place:

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
begin;
\i supabase/migrations/20261028000001_fix_roster_joins_and_config_grading.sql
-- optional, only with owner approval:
-- \i supabase/migrations/20261028000002_revoke_anon_execute_analytics.sql
-- verify inside the transaction before commit (see post-deploy checks)
commit;   -- or ROLLBACK if any check fails
SQL
```

Never apply `20261028000000` over the existing functions: it `DROP`s and
recreates all five, resets their ACL to the default PUBLIC grant, and is the
rollback artifact, not a deploy step. Never run `supabase db push`, which would
replay it.

Post-deploy checks, as a real staging admin JWT:

- the 224-mark exam returns total 224, 224 subjects, one row per student;
- the dashboard RPCs return without `No grade level matches score`;
- draft/unpublished exams still raise `Exam is not published`;
- missing/mismatched tenant claims still raise;
- cross-tenant student/exam report attempts still raise;
- class/stream filters match `student_enrollments`, including same-year `created_at` tie-break;
- DENSE_RANK positions are unchanged in ordering relative to the baseline;
- `get_grade_distribution` broad counts reconcile with `total_students`.

Then run the five suites against staging **only if** the project owner accepts that they insert and roll back fixture rows there:

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/analytics_tenant_isolation.sql
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/analytics_isolation_extra.sql
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/join_multiplication_and_roster.sql
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/grading_boundaries.sql
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/student_report_header.sql
```

If the owner prefers a read-only staging run, use only the post-deploy queries against existing exams and skip the fixture suites; record that distinction explicitly.

Rollback, in this exact order:

```sql
-- 1. Restore the pre-change function set. Drops/recreates all five; restores
--    the known-broken 2016/6048 multiplication, the students.* report header,
--    and the default PUBLIC ACL.
\i supabase/migrations/20261028000000_create_analytics_functions.sql
-- 2. Re-apply the correctness fix (step 1 reverted it).
\i supabase/migrations/20261028000001_fix_roster_joins_and_config_grading.sql
-- 3. Only if 000002 was in use: close anonymous EXECUTE again.
\i supabase/migrations/20261028000002_revoke_anon_execute_analytics.sql
-- 4. Only if 000003 was in use: restore the enrollment-based report header.
\i supabase/migrations/20261028000003_fix_student_report_header.sql
```

Then re-run the read-only verification queries and record the output. Rollback
is a safety valve: it restores the inflated totals, not a working fix.

---

## 2. Test results from the actual staging schema

**NOT RUN — BLOCKED** (see section 1). No result below is a staging result.

Executed on disposable PostgreSQL 17 (throwaway `embedded-postgres@17.10.0-beta.17` cluster, port 55432, real PostgreSQL binaries; base schema reconstructed by `supabase/tests/support/local_base_schema.sql`, test-only):

| Check | Result |
| --- | --- |
| migrations `20261028000000`, `20261028000001`, `20261028000002`, `20261028000003` apply | PASS (run 4) |
| `20261028000001`, `20261028000002`, `20261028000003` re-apply (idempotent) | PASS |
| signature / owner / `prosecdef=false` / `provolatile='s'` preserved | PASS |
| join multiplication | PASS — baseline 2016 / 6048; fixed 224, 1 row, 224 subjects |
| enrollment precedence incl. same-year `created_at` tie-break | PASS (plus reversed-order negative control) |
| report header H1–H7 (exam-year enrollment, no duplication, fallbacks, ACL) | PASS (run 4) |
| grading boundaries / config gaps / broad reconciliation / 2-dp rounding | PASS |
| pass mark `score >= 40` unchanged | PASS |
| tenant isolation, publication guards, cross-tenant reports | PASS |
| authorization-only suite on baseline (no regression) | PASS |
| rollback drill (re-apply `20261028000000`) | PASS — 6048 restored, grants kept |
| anon revoke proposal: matrix, PUBLIC, idempotency, anon 42501 | PASS |
| anon revoke proposal: all suites + rollback | PASS |
| rollback order: baseline recreation reopens anon EXECUTE; `000001` preserves it; `000002` closes it; `000003` keeps it closed | PASS (run 4) |
| app install / unit tests / typecheck / lint | PASS — 532 packages, 88 tests, `tsc --noEmit`, `next lint`, all exit 0 |
| `next build` (14.2.35) | PASS — `/`, `/analytics`, `/analytics/report/[studentId]`, `/login` |
| browser E2E with a real tenant | NOT RUN — no staging project or seeded user |

Differences from a real staging run that remain unknown: schema drift, real ACLs, real trigger/policy definitions, real data reconciliation. These are the reasons staging is a blocker rather than a formality.

---

## 3. Pass-mark decision status

**Status: OPEN — requires owner confirmation. No change made.**

- Rule: `score >= 40` counts a mark as passed.
- Location: hardcoded in `get_class_performance` (`passed_count`) and `get_subject_performance` (`pass_count`, `pass_rate`, `be_count`), and in the baseline `get_grade_distribution`.
- Schema: no pass-mark column, setting, or grading-config field exists.
- Grading scales differ per tenant and school level, but the pass mark does not; that may or may not be intended.
- Decision needed: confirm 40 applies to every school level/mode, or supply an approved requirement (config field or per-level value). Until then the current rule is preserved deliberately.

The option comparison and sign-off block are in `PRODUCT_DECISIONS.md` (item A). No implementation happens until that is signed.

---

## 4. Anonymous execution privilege review

**Observed before any proposal** (disposable PG, after `20261028000001`):

```json
{"anon_can_execute":true,"auth_can_execute":true,"service_can_execute":true}
```

Both migrations only `GRANT`; neither revokes PostgreSQL's default `EXECUTE … TO PUBLIC`, so `anon` inherits EXECUTE on all five functions. Production ACLs were **not** inspected — the project is unreachable from this account — so this is inferred from the migrations' GRANT-only history and must be confirmed by the pre-flight `proacl` query in section 1. The matrix below was measured on disposable PostgreSQL 17.

**Is anonymous execution needed?** No evidence of a supported anonymous flow:

- The dashboard and report card are signed-in screens; `describeAnalyticsError()` maps `PGRST301`/`401` to “Your session has expired. Please sign in again.”
- Every RPC requires a `tenant_id` JWT claim. An anon JWT has none, so every call raises `Missing tenant claim` even with EXECUTE.
- No public/share-token path exists in the repository.

Caveat: this repository slice has no auth middleware and no `src/lib/supabase/client.ts`, so session gating cannot be audited end-to-end here.

**Proposed narrowest change** — `supabase/migrations/20261028000002_revoke_anon_execute_analytics.sql`:

```sql
REVOKE EXECUTE ON FUNCTION public.<fn>(<args>) FROM PUBLIC, anon;   -- all five
GRANT  EXECUTE ON FUNCTION public.<fn>(<args>) TO authenticated;    -- re-assert
GRANT  EXECUTE ON FUNCTION public.<fn>(<args>) TO service_role;     -- re-assert
```

No body, signature, volatility, owner, or guard changes.

**Validated on disposable PostgreSQL 17:**

| Check | Result |
| --- | --- |
| anon EXECUTE before revoke | true (defect reproduced) |
| anon EXECUTE after revoke | false |
| authenticated / service_role after revoke | true / true |
| brand-new unprivileged role (PUBLIC probe) | no EXECUTE |
| anon RPC call after revoke | `permission denied for function get_class_performance` |
| all four suites after revoke | PASS |
| idempotent re-apply | PASS |
| rollback (`GRANT … TO PUBLIC`) | anon true again; re-apply closes it |
| rollback order: re-create via `20261028000000` | anon true again (default PUBLIC ACL restored); re-apply `000002` closes it |

**Not applied to any database.** Deployment requires owner approval (decision B in `PRODUCT_DECISIONS.md`).

**Exact order and rollback implications**

1. Deploy `20261028000001` (correctness fix). Optionally `20261028000002` in the same transaction if approved.
2. If `20261028000002` was applied, do not re-run `20261028000000` for any reason other than a deliberate rollback: it DROPs and recreates all five functions, resets their ACL to the default PUBLIC grant, and restores the inflated 2016/6048 behaviour.
3. Rollback order is therefore `20261028000000` first, then `20261028000002` again to close the reopened anon grant. Doing them in the other order leaves `anon` with EXECUTE.
4. Re-running `20261028000001` after the hardening does not reopen the grant (`CREATE OR REPLACE` keeps the existing ACL), so it is safe to re-apply.
5. Never use `supabase db push` for any of this: it replays `20261028000000` and causes the same ACL reset.

Proof: run 2 of the disposable harness re-applied `20261028000000` after the hardening and observed anon EXECUTE `true`, then re-applied `20261028000002` and observed `false` (`supabase/tests/disposable/evidence-2026-10-28-run2.log`).

---

## 5. Migration-history reconciliation plan

**Facts:**

- The five functions were reportedly installed by direct SQL on `fzwexcgsyzdqyauwccah` and are absent from `supabase_migrations.schema_migrations` (reported; cannot be verified without access — production is not reachable by this account).
- `20261028000000_create_analytics_functions.sql` is **byte-identical** (SHA-256 `73B4A631…C5F837`) to the root `analytics_migration.sql` whose header reads “Synced from live DB”. This corroborates that the repository baseline mirrors the live bodies, but it is corroboration, not proof of current live state.
- There is no linked project, no local migration history, and no CLI access to the TUSOME project.

**Safest strategy (not executed):**

1. **Read-only audit first.** With owner-provided, least-privilege access, capture `pg_get_functiondef()` for all five functions, `proacl`, owner, `prosecdef`, `provolatile`, and `select * from supabase_migrations.schema_migrations`. Normalise and diff against `20261028000000`.
2. **Decision gate.** If live bodies match `20261028000000`, the deployment delta is exactly `20261028000001` (plus `20261028000002` if approved). If they differ, stop: write a new baseline migration reflecting reality before changing anything.
3. **Deploy by reviewed SQL, in a transaction, in a low-traffic window.** Do not run `supabase db push`: it would try to execute `20261028000000` (which `DROP`s and recreates all five functions) and would also try `20261028000001`/`20261028000002`.
4. **Leave migration history untouched.** Record the deployment in an out-of-band change log (who, when, hashes, verification output). Do **not** insert fabricated rows and do **not** run `supabase migration repair`.
5. **Only if the organisation requires CLI-managed history**, raise it as a separate owner-approved decision after step 1 has proved the live state. Any repair must reflect verified reality and be reviewed; this report does not authorise it.
6. **Post-deploy**: re-run the read-only verification queries and compare to the staging evidence; keep `20261028000000` available as the rollback artifact.

**Why not simply “mark 000000 as applied”:** that writes a history row asserting a deployment that did not happen through the CLI, and it hides the direct-SQL provenance. It also does not change the live functions. It is only defensible as an owner-approved bookkeeping decision after a verified diff, never as a shortcut.

---

## 6. Deployment risks and rollback prerequisites

| Risk | Impact | Mitigation |
| --- | --- | --- |
| No real-schema staging run | Unknown drift/ACL/trigger differences could break the fix or the guards | Complete section 1 before deploying |
| Pass mark unconfirmed | Wrong pass counts/pass rates for some tenants | Owner sign-off on `>= 40` or a config requirement |
| `db push` would run `20261028000000` | Drops/recreates all five functions, briefly breaks RPCs, resets ACLs | Deploy `20261028000001` (+`000002`) by reviewed SQL; never `push` |
| Direct-SQL provenance absent from history | Future tooling may replay `20261028000000` unexpectedly | Section 5 audit + change log; do not fabricate history |
| Function recreated during rollback | PUBLIC grant returns; anon privilege reopens | Re-apply `20261028000002` after any recreation |
| Report header prefers `students.*` over enrollment | Wrong class/stream on a report card if data diverges | Zero mismatches today; proposed `20261028000003` switches to enrollment, unapplied pending decision C |
| Deploy window locking | `CREATE OR REPLACE FUNCTION` needs a brief exclusive lock | Low-traffic window; functions are `STABLE`, calls are short |
| No Git repository | No commit/PR trail, no easy revert | SHA-256 inventory (`VALIDATION_HASHES.txt`) + keep baseline copy |
| App not verified against staging | Local install/test/typecheck/lint/build pass, but no browser E2E with a real tenant | Run Gate 7 browser checks once staging exists |

**Rollback prerequisites (must exist before deployment):**

1. `pg_get_functiondef()` output and `proacl` captured for all five functions.
2. Confirmation that `20261028000000` still matches the pre-change live bodies (normalised diff).
3. `20261028000000` retained as the rollback artifact; it `DROP`s and recreates all five and re-grants.
4. A verified rollback drill on the target class of database (done on disposable PG: 6048 restored, grants kept).
5. Agreement that rollback restores the *known-broken* multiplication behaviour (2016/6048) — rollback is a safety valve, not a fix.
6. If `20261028000002` was applied, either re-apply it after rollback or accept the reopened anon grant.
7. Re-apply `20261028000001` after `000000` (the baseline reverts the correctness fix), then `000002` and `000003` in that order if they were in use.

---

## 7. Final status

| Area | Status |
| --- | --- |
| Repository correctness fix (`20261028000001`) | READY FOR REVIEW — validated on disposable PG 17 |
| Report header (`20261028000003`) | PROPOSED — validated on disposable PG 17, not applied; decision C open |
| Real-schema staging validation | **BLOCKED** — no authorized staging database |
| Pass-mark product decision | **OPEN** — owner confirmation required |
| Anonymous EXECUTE hardening | PROPOSED, tested on disposable PG, not applied |
| Migration-history reconciliation | PLAN ONLY — audit access required; nothing executed |
| Application build/unit verification | PASS locally — install, 88 tests, typecheck, lint, production build |
| Browser E2E on a real tenant | **NOT RUN** — depends on staging access |
| Production deployment | **NOT APPROVED** |

**Overall: BLOCKED.** Not `READY FOR DEPLOYMENT`: staging validation and the pass-mark approval are demonstrably incomplete, and the hardening/report-header proposals are unapproved. The eight required gates are tracked in `DEPLOYMENT_CHECKLIST.md`; the owner actions are in `PRODUCT_DECISIONS.md`.

---

## 8. Addendum — run 4 and application completion (2026-10-28 19:30 +03:00)

This section supersedes the older run counts above; the earlier sections are
retained as the historical run-1/run-2 record.

- Disposable harness run 4: **73 PASS, 0 FAIL, 5 EVIDENCE, exit 0**
  (`supabase/tests/disposable/evidence-2026-10-28-run4.log`).
- The harness now applies `000000` → `000001` → `000002` → `000003`, runs all
  five SQL suites, and re-checks the re-apply order after a baseline rollback.
  `000001` keeps anon EXECUTE (ACL preserved); `000002` closes it; `000003`
  leaves it closed and passes H1–H7.
- The application was reconstructed and implemented in this workspace:
  `npm install` (532 packages), `npm test` (88 tests, 9 files), `npm run
  typecheck`, `npm run lint`, and `npm run build` all exited 0. Routes built:
  `/`, `/analytics`, `/analytics/report/[studentId]`, `/login`.
- Detail and exact commands: `ANALYTICS_COMPLETION_REPORT.md`.
- Still blocked: staging access, browser E2E with a real tenant, independent
  review, owner decisions A/B/C, deployment authorization.
