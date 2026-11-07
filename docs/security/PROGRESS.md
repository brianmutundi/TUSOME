# RBAC Security Audit Progress

## Batch: Phase 1 — Inventory
- Date: 2026-11-07
- Files changed: docs/security/INVENTORY.md (created)
- No application code changed.
- Tests run: none (Phase 1 is read-only inventory).
- Open items: Phase 2 permission engine audit pending.

## Batch: Phase 11 — Tests (matrix + attack test checklist)
- Date: 2026-11-07
- Files changed: src/lib/analytics/routePermissions.matrix.test.ts (new)
- Findings: Added table-driven route-guard matrix (fail-closed unknown routes, null/empty perms deny, admin reaches all, teacher scoping). Attack tests requiring a live DB (cross-tenant, swapped student/class/tenant IDs, direct API calls, unauthorized export/download, private file access, tampered browser metadata, self-escalation, multi-role DENY bypass, another parent's child, unassigned class, another school, permission-load failure, unregistered route, revoked/expired account, anon-key access) are listed as NOT RUN — see docs/security/PHASE11_ATTACK_TESTS.md.
- Tests: typecheck 0, 361 tests pass (29 files).
- Open items: Phase 12 re-audit + final report.
