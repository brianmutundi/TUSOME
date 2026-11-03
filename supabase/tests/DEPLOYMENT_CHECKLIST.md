# TUSOME Analytics — Deployment Readiness Checklist

Date: 2026-10-28
Current status: **BLOCKED**. No gate is fully signed off, and no production
change has been made.

This is the gate list that must be complete before `20261028000001` (and, if
approved, `20261028000002` and `20261028000003`) may be applied to a real
database. It complements `STAGING_VALIDATION_REPORT.md` (procedure and
evidence), `PRODUCT_DECISIONS.md` (owner sign-off), and
`ANALYTICS_COMPLETION_REPORT.md` (what is built and executed).

Rules that apply to every gate:

- Production is never the test environment.
- No `supabase db push`; deploy reviewed SQL only (it would replay
  `20261028000000` and drop/recreate all five functions).
- No `supabase migration repair`, no `INSERT` into
  `supabase_migrations.schema_migrations`.
- No credentials in this repository, in reports, or in logs.

---

## Gate 1 — Product-owner decisions recorded

- [ ] A: pass mark confirmed as `score >= 40`, or an approved alternative spec
- [ ] B: `20261028000002` approved, approved-for-later, or rejected
- [ ] C: `20261028000003` (report header from enrollment) approved, approved-for-later, or rejected
- [ ] Decisions recorded in `PRODUCT_DECISIONS.md` with owner name and date
- [ ] Any approved change has its own reviewed migration — not an edit to a
      validated migration

Evidence: signed `PRODUCT_DECISIONS.md`.
Blocker today: none of A/B/C is signed. `000003` is written and tested on
disposable PostgreSQL but unapplied; C remains a product decision.

---

## Gate 2 — Authorized staging access confirmed

- [ ] A dedicated TUSOME staging project exists (not production, not
      `E-REPORTS`, not `V2p`)
- [ ] Written authorization names the operator and the target project ref
- [ ] Identity proof captured: project ref, org, region, `select version()`,
      and a schema fingerprint, cross-checked against production **metadata
      only**
- [ ] Guard refuses `fzwexcgsyzdqyauwccah` and any empty/unset ref
- [ ] Access is least-privilege and time-boxed; credentials live outside the repo

Evidence: staging identity capture in the validation report.
Blocker today: the CLI account sees only unrelated projects; no staging URL.

---

## Gate 3 — Real-schema staging tests passed

- [ ] Read-only pre-flight completed (functions, `proacl`, owner, triggers,
      policies, roles, `schema_migrations`)
- [ ] Normalised diff of live function definitions vs `20261028000000`
      reviewed and accepted
- [ ] `20261028000001` applied in a transaction in an approved window
- [ ] Read-only post-deploy checks passed (224-mark exam, filters, ranking,
      publication guards, tenant/cross-tenant guards, broad reconciliation)
- [ ] Fixture suites run **only if** the owner authorizes fixture inserts on
      staging; otherwise the read-only subset is recorded as such
- [ ] Results compared with the disposable PG 17 evidence; every difference
      explained
- [ ] Rollback drill performed on staging or an equivalent real-schema clone

Evidence: captured query output, suite output, and a written diff review.
Blocker today: no staging database, so this gate cannot start.

---

## Gate 4 — Migration definitions and grants reviewed

- [ ] `20261028000000` unchanged and byte-identical to the live-mirror baseline
- [ ] `20261028000001` reviewed line by line: signature, owner,
      `prosecdef=false`, `provolatile='s'`, no pass-mark change
- [ ] `20261028000002` (if approved) reviewed: only REVOKE/GRANT, correct
      function signatures, `authenticated`/`service_role` re-asserted
- [ ] `20261028000003` (if approved) reviewed: only
      `CREATE OR REPLACE get_student_report_data`, signature/return type
      unchanged, enrollment precedence documented, no pass-mark change
- [ ] Final `proacl` for all five functions agrees with the approved matrix
- [ ] REVOKE/GRANT and replace ordering documented
      (000000 → 000001 → 000002 → 000003)
- [ ] Reviewer is someone other than the author, or the owner explicitly waives
      four-eyes review in writing

Evidence: review sign-off with file hashes from `VALIDATION_HASHES.txt`.
Blocker today: `000002` and `000003` are unapproved; no independent reviewer.

---

## Gate 5 — Rollback definitions and ACLs captured

- [ ] `pg_get_functiondef()` captured for all five functions **before** change
- [ ] `proacl`, owner, `prosecdef`, `provolatile` captured before change
- [ ] Confirmation that `20261028000000` still reproduces the pre-change live
      bodies; if not, a new baseline is written first
- [ ] Rollback artifact stored outside the deployment host and hash-recorded
- [ ] Owner accepts that rollback restores the inflated 2016/6048 behaviour,
      reverts the report header to `students.*`, and reopens anon EXECUTE until
      `000001`/`000002`/`000003` are re-applied
- [ ] Rollback re-apply order written down: `20261028000000`, then `000001`,
      then `000002` and `000003` if they were in use
- [ ] Rollback drill result attached

Evidence: captured definitions/ACLs plus the disposable drill output.
Blocker today: live definitions and ACLs cannot be captured without access.

---

## Gate 6 — Migration-history strategy approved

- [ ] Fact recorded: live functions were installed by direct SQL and are absent
      from `supabase_migrations.schema_migrations`
- [ ] Owner chooses: leave history untouched + out-of-band change log
      (recommended), or a separately approved, verified history reconciliation
- [ ] No fabricated rows and no `migration repair` in the chosen plan
- [ ] Out-of-band change-log template ready (who, when, ref, hashes, SQL,
      verification output, rollback artifact)
- [ ] Team knows `db push` is forbidden for this change

Evidence: approved strategy note in the validation report.
Blocker today: strategy needs owner approval and a verified live diff.

---

## Gate 7 — Application build verification against the real application

- [x] Verification run inside the application workspace, with a reconstructed
      `package.json`, lockfile, Next.js config, and `src/lib/supabase/client.ts`
      (the original manifest/config were missing and were rebuilt from the
      code's imports; this is not proof of the original repository setup)
- [x] Dependencies installed from the reconstructed lockfile
- [x] Typecheck and lint pass with the project config
      (`npm run typecheck`, `npm run lint` — both exit 0)
- [x] Production build passes (`npm run build`, Next.js 14.2.35 — exit 0)
- [x] Unit/component tests pass (`npm test` — 88 tests, 9 files, exit 0)
- [ ] The analytics dashboard and report card exercised against staging with a
      real signed-in tenant user (not just RPC calls)
- [ ] Error paths checked in a browser: expired session, missing tenant claim,
      unpublished exam, cross-tenant report

Evidence: local build/test logs recorded in `ANALYTICS_COMPLETION_REPORT.md`.
Blocker today: the app is reconstructed and only locally verified; browser E2E
against a real tenant requires Gate 2 staging access and a seeded user. The
error paths are covered by unit tests and the SQL suites, not by a live browser.

---

## Gate 8 — Deployment authorization explicitly granted

- [ ] Written go-ahead naming the target project, the exact migrations, the
      deploy window, and the operator
- [ ] Gates 1–7 marked complete with links to evidence
- [ ] On-call/owner reachable during the window
- [ ] Post-deploy verification owner named
- [ ] Rollback decision-maker named, with a stated trigger (e.g. dashboard RPC
      errors, wrong totals)
- [ ] Change log opened before the first statement runs

Evidence: authorization message or ticket reference (no secrets).
Blocker today: no authorization, and Gates 1–7 are incomplete.

---

## Deploy order (only after all gates pass)

1. Capture pre-change definitions/ACLs (read-only).
2. Begin transaction; apply `20261028000001`.
3. Optionally apply `20261028000002` in the same transaction if approved.
4. Optionally apply `20261028000003` in the same transaction if approved.
5. Run the read-only post-deploy checks inside the transaction.
6. Commit only if all checks pass; otherwise `ROLLBACK`.
7. Run the post-commit read-only verification and record output.
8. Record the deployment out-of-band. Do not write migration-history rows.

## Rollback order

1. Apply `20261028000000` (drops/recreates all five functions; restores the
   known-broken multiplication behaviour, the `students.*` report header, and
   the default PUBLIC ACL).
2. Re-apply `20261028000001` to restore the correctness fix.
3. If `20261028000002` was in use, re-apply it to close anon EXECUTE again.
4. If `20261028000003` was in use, re-apply it to restore the enrollment header.
5. Re-run the read-only verification queries and record the result.
6. Record the rollback out-of-band.

## Current gate summary

| Gate | Status |
| --- | --- |
| 1 Product decisions | BLOCKED — unsigned |
| 2 Staging access | BLOCKED — no authorized staging project |
| 3 Staging tests | BLOCKED — depends on Gate 2 |
| 4 Migration/grants review | PARTIAL — disposable review done, no independent reviewer |
| 5 Rollback definitions | PARTIAL — drill done, live capture impossible |
| 6 History strategy | BLOCKED — needs owner approval and live diff |
| 7 App build | PARTIAL — install, tests, typecheck, lint, build PASS locally; staging browser E2E NOT RUN |
| 8 Deployment authorization | BLOCKED — not granted |
