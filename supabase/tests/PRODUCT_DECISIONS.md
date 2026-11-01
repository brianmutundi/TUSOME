# TUSOME Analytics — Product Owner Decision Checklist

Date: 2026-10-28
Status: **awaiting owner sign-off**. Nothing in this file has been applied to a database.

These three decisions are blockers for `READY FOR DEPLOYMENT`. Reply with
"approve / reject / defer" plus any conditions for each item. No production
change will be made until A and B are answered and C is either answered or
explicitly deferred.

---

## A. Pass mark: keep `score >= 40` or make it configurable?

**Current behaviour.** A mark counts as passed when `score >= 40`. The rule is
hardcoded in `get_class_performance` (`passed_count`) and
`get_subject_performance` (`pass_count`, `pass_rate`, `be_count`), and in the
baseline `get_grade_distribution`.

**Facts the owner should weigh**

- The schema has no pass-mark column, setting, or grading-config field.
- Grading scales already vary per tenant and school level; the pass mark does
  not. Every tenant is currently treated as if 40 is its pass mark.
- Changing it is not a one-line config flip: a new column/setting, a migration,
  updated function bodies, updated tests, and a data decision for existing
  tenants would all be required.
- The current value is preserved deliberately and is covered by tests.

**Options**

| Option | Meaning | Change required | Risk if wrong |
| --- | --- | --- | --- |
| A1 (default, no work) | Confirm 40 is correct for every school level and tenant | None | Wrong pass counts/rates for tenants whose real pass mark differs |
| A2 | Add a per-tenant or per-school-level pass mark | New column/setting + migration + function change + tests; owner supplies default and backfill | Larger change, longer validation, needs data entry |
| A3 | Derive the pass mark from the grading configuration | Needs an agreed rule (e.g. lowest grade in a "pass" band) + migration + tests | Ambiguity for configs with gaps or no pass flag |

**Decision required**

- [ ] A1 — keep `score >= 40` (recommended if 40 is the national/TUSOME rule)
- [ ] A2 — configurable, specification attached
- [ ] A3 — derive from grading configuration, rule attached
- [ ] Defer — deployment stays blocked

Owner: ______________________  Date: __________  Notes: ______________________

---

## B. Approve `20261028000002_revoke_anon_execute_analytics.sql`?

**What it changes.** Revokes the inherited PostgreSQL `PUBLIC` EXECUTE grant and
any direct `anon` grant on the five analytics functions, then re-asserts
`authenticated` and `service_role`. No function body, signature, volatility,
owner, guard, or pass mark changes.

**Why.** Both deployed migrations only `GRANT`; neither revokes the default
`EXECUTE … TO PUBLIC`, so `anon` inherits EXECUTE. Anonymous calls currently
fail closed (`Missing tenant claim`), so this is defence in depth, not an open
data leak. No supported anonymous flow exists in the repository.

**Evidence (disposable PostgreSQL 17, not production)**

- anon EXECUTE true → false; PUBLIC probe role has none;
  `authenticated`/`service_role` stay true.
- anon call becomes `permission denied for function get_class_performance`.
- All SQL suites still pass; re-apply is idempotent.
- Re-applying the baseline `20261028000000` recreates the functions and
  reopens anon EXECUTE; `000001` keeps it open; re-applying `20261028000002`
  closes it again, and `000003` leaves it closed.

**Cost / risk if approved.** One extra migration in the deploy order; must be
re-applied after any rollback that recreates the functions. If a future feature
genuinely needs anonymous report access, a deliberate grant would have to be
added — that is the intended trade-off.

**Decision required**

- [ ] Approve and include in the same deployment as `20261028000001`
- [ ] Approve but deploy separately, after `20261028000001` is verified
- [ ] Reject — anonymous EXECUTE must remain
- [ ] Defer — deployment stays blocked

Owner: ______________________  Date: __________  Notes: ______________________

---

## C. Report header source: latest enrollment or `students.*`?

**Current behaviour.** The student report header reads class/stream from
`students.class_id` / `students.stream_id`, with an **unordered** `LIMIT 1`
enrollment fallback, while the roster logic uses the latest
`student_enrollments` row (`academic_year DESC, created_at DESC`) with
`COALESCE(latest_enrollment.class_id, students.class_id)`. There are **0 live
mismatches** reported today, so this is a latent inconsistency rather than an
observed defect: a promoted or transferred student can show a stale class/stream
on the report card while their marks are ranked in the correct class.

**Proposed implementation (written, not applied).**
`20261028000003_fix_student_report_header.sql` replaces only
`get_student_report_data` with option C1 below: prefer the enrollment for the
exam's academic year, then latest `academic_year` / `created_at` / `id`, and
fall back to `students.*` only when no enrollment exists. It also exposes
`student.academic_year`. The migration has passed H1–H7 on disposable
PostgreSQL 17 and preserves ACLs, but **it is in no database**. Approving C1
means approving this migration as written (or specifying changes).

**Options**

| Option | Meaning | Change required | Risk if wrong |
| --- | --- | --- | --- |
| C1 | Use the latest enrollment as authoritative (match roster logic) | Function/query change in `get_student_report_data` or the report page + tests | Header changes for any student whose `students.*` disagrees with enrollment; needs acceptance |
| C2 (status quo) | Keep preferring `students.*` | None | Stale header for promoted/transferred students once data diverges |
| C3 | Show both, or flag a mismatch | UI + query change | More UI surface and copy to agree |

**Decision required**

- [ ] C1 — latest enrollment is authoritative (recommended for consistency with ranking); approves `20261028000003` as written
- [ ] C2 — keep `students.*` (reject `20261028000003`)
- [ ] C3 — show/flag a mismatch (specify the display)
- [ ] Defer — allowed; `20261028000003` stays unapplied but the defect note remains

Owner: ______________________  Date: __________  Notes: ______________________

---

## Effect on deployment status

| Decision | Blocks deployment? | If unresolved |
| --- | --- | --- |
| A (pass mark) | **Yes** — it changes reported results | Deployment stays BLOCKED |
| B (anon hardening) | **Yes** for including `000002`; not for `000001` alone | Deploy `000001` only, with anon EXECUTE knowingly retained |
| C (report header) | No, but must be recorded | Ship `000001`, keep the defect note and leave `000003` unapplied |

Approval of this checklist does **not** authorize deployment. Deployment also
requires the gates in `DEPLOYMENT_CHECKLIST.md`.
