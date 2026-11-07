# RBAC Security Audit Progress

## Batch: Phase 1 — Inventory
- Date: 2026-11-07
- Files changed: docs/security/INVENTORY.md (created)
- No application code changed.
- Tests run: none (Phase 1 is read-only inventory).
- Open items: Phase 2 permission engine audit pending.

## Batch: Phase 9 — Resource-level isolation
- Date: 2026-11-07
- Files changed: docs/security/PHASE9_AUDIT.md (created)
- Findings: Parent uses assert_parent_of guards; teachers use allocations; RLS tenant-scoped. Per-RPC ownership unaudited (no DB).
- Tests: none (read-only audit).
- Open items: Phase 10 files/exports.
