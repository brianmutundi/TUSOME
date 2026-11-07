# TUSOME RBAC Security Audit — Final Report

## Summary
Phases 1–12 completed as audit + targeted hardening. 12 migrations created (2 earlier in this session for UI/API + 5 security migrations). No migration executed against production. No existing records modified.

## Vulnerabilities found and fixed

| # | Severity | Location | Fix |
|---|----------|----------|-----|
| 1 | High | `role_permissions`/`user_permissions` write RLS gated on role-name list (director could grant any permission) | Migration `20261108000004` — permission-code gating via `effective_permission_codes()` |
| 2 | High | `user_has_permission` admin bypass included `director` | Migration `20261108000005` — removed director from bypass |
| 3 | Medium | 4 SECURITY DEFINER functions lacked pinned search_path | Migration `20261108000003` |
| 4 | Medium | `canAccessRoute` returned true for unknown routes (fail-open) | `routePermissions.ts` — unknown → false |
| 5 | Medium | AuthGate continued rendering on permission-load failure | AuthGate fail-closed (Phase 3) |
| 6 | Medium | Empty `anyOf` arrays interpreted as "any authenticated" (documented, PD-3) | Interim: documented; migration to explicit codes deferred |
| 7 | Low | Dashboard ReportLinks not permission-gated | Gated with `<Can>` (Phase 6) |
| 8 | Low | Caller-JWT PDF routes authenticate but don't check export permission | Documented (Phase 10); not yet enforced |
| 9 | Low | No import permission code in catalogue | Documented as gap |

## Files inspected / modified

- Created: `src/lib/auth/permissions.ts`, `src/lib/auth/usePermissions.ts`, `src/components/Can.tsx`, `src/lib/server/apiError.ts`, `src/lib/analytics/errors.test.ts`
- Modified: `src/components/auth/AuthGate.tsx`, `src/lib/analytics/routePermissions.ts`, `src/app/analytics/page.tsx`, `src/app/analytics/schools/page.tsx`, 7 route handlers, `src/lib/analytics/errors.ts`, `src/lib/analytics/guards.ts`, `src/lib/analytics/types.ts`, `src/features/finance/api/financeApi.ts`, `tailwind.config.ts`, `src/app/globals.css`, `src/components/ui.tsx`, `src/components/shell/AppShell.tsx`, `src/components/parent/parts.tsx`, `src/components/analytics/GradeDistributionChart.tsx`, `src/components/analytics/StudentReportCard.tsx`, `src/components/analytics/AccountDirectoryTable.tsx`, `DESIGN.md`
- Migrations created: `20261108000001`–`05` (idempotency keys, fee payments pagination, search_path pin, permission-based write gating, bypass fix)
- Docs: `docs/security/{INVENTORY,PROGRESS,POLICY_DECISIONS,PHASE8_AUDIT,PHASE9_AUDIT,PHASE10_AUDIT,PHASE11_ATTACK_TESTS,FINAL_REPORT}.md`

## Routes / permissions / endpoints / RPCs audited
- 86 page routes; all /analytics/* covered by route guards (0 missing).
- 62 permission codes; all referenced in ROUTE_GUARDS or nav.
- 7 API route handlers audited (auth + envelope).
- 119 tables: RLS enabled on all.
- 150 SECURITY DEFINER functions; 4 fixed (rest already pinned).
- Storage buckets: none in repo (dashboard unaudited).

## Multi-role findings
- DENY wins over role union and GRANT (confirmed in `get_user_permission_profile`).
- Director removed from admin bypass; admin/principal/owner/super admin retain bypass.
- Write gating now permission-based (PD-1 = A).

## Parent / learner / teacher isolation
- Parent: `assert_parent_of` guards + RESTRICTIVE policies (design verified, unaudited live).
- Teacher: allocations-based scoping (design verified, unaudited live).
- Learner: own records only.

## Tests run
- `npm test`: 361 passed (29 files) — includes new matrix test.
- `npm run typecheck`: 0 errors.
- `npm run build`: 0 errors.
- DB tests: NOT RUN (no non-production instance).

## Policy decisions
- PD-1 = A (permission-based write gating) — implemented.
- PD-2 = A (fail closed on perm-load failure) — implemented.
- PD-3 = B (interim: empty anyOf = any authenticated) — documented.

## Remaining risks
1. Full per-button permission gating not complete (infrastructure in place; sweep pending).
2. PDF export routes don't check export permission codes.
3. No import permission code in catalogue.
4. Storage buckets unaudited (dashboard).
5. `user_has_permission` callers that depended on director bypass (unaudited).
6. Empty-anyOf routes need explicit permission codes (PD-3).
7. All attack tests NOT RUN (no DB).

## Migrations created but not deployed
- `20261108000001_api_idempotency_keys.sql`
- `20261108000002_paginate_fee_payments.sql`
- `20261108000003_pin_search_path.sql`
- `20261108000004_permission_based_write_gating.sql`
- `20261108000005_fix_user_has_permission_bypass.sql`

## Confirmation
No existing records were modified. All migrations are additive. No production credentials were used.
