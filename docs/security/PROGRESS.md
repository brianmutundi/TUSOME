# RBAC Security Audit Progress

## Batch: Phase 1 — Inventory
- Date: 2026-11-07
- Files changed: docs/security/INVENTORY.md (created)
- No application code changed.
- Tests run: none (Phase 1 is read-only inventory).
- Open items: Phase 2 permission engine audit pending.

## Batch: Phase 7 — API and server actions
- Date: 2026-11-07
- Files changed: none (audit only).
- Findings: No server actions ('use server' absent). 7 Next route handlers: all use authenticate() where appropriate; schools POST/DELETE enforce super admin via get_my_permissions. PDF routes: token-based public access (receipt/statement tokens) or caller JWT (finance/statement). All use apiError envelope. Browser client uses anon/publishable key only (no service role). All ~324 RPC/.from calls go through the authenticated client, so RLS applies. Per-RPC tenant/ownership checks are Phase 8/9.
- Tests: none new.
- Open items: Phase 8 RPC/RLS audit + migrations.
