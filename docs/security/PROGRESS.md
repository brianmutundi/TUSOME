# RBAC Security Audit Progress

## Batch: Phase 1 — Inventory
- Date: 2026-11-07
- Files changed: docs/security/INVENTORY.md (created)
- No application code changed.
- Tests run: none (Phase 1 is read-only inventory).
- Open items: Phase 2 permission engine audit pending.

## Batch: Phase 8 — RPC and RLS
- Date: 2026-11-07
- Files changed: 3 migrations (20261108000003, 04, 05) + docs/security/PHASE8_AUDIT.md
- Findings: RLS on all 119 tables; 4 un-pinned SECURITY DEFINER functions fixed; PD-1 permission-based write gating; director removed from user_has_permission bypass.
- DB verification: NOT RUN (no Docker/non-prod instance). Marked unaudited.
- Tests: typecheck 0 (migrations don't affect TS).
- Open items: Phase 9 resource isolation.
