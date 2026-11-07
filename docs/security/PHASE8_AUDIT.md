# Phase 8 — RPC and RLS audit (read-only, from migrations)

## RLS
- 119 application tables; all have `ENABLE ROW LEVEL SECURITY` (1:1 with CREATE TABLE).
- 151 policies total. Tenant-scoped SELECT/INSERT/UPDATE/DELETE policies use `tenant_id = public.my_tenant_id()`.
- Write policies on `role_permissions` and `user_permissions` were role-name based (admin/principal/director/owner/super admin). Fixed in migration `20261108000004` to require `can-manage-user-permissions` via `effective_permission_codes()`.

## SECURITY DEFINER functions
- 150 SECURITY DEFINER functions.
- 4 lacked a pinned `search_path`: `prevent_audit_modification`, `log_audit_event`, `log_sensitive_field_access`, `normalize_ke_phone`. Fixed in migration `20261108000003`.
- Remaining functions already pin `search_path = ''`.

## Permission bypass
- `user_has_permission` returned true for any admin-level role including `director`. Removed `director` from the bypass list (migration `20261108000005`). Directors now rely on their (limited) effective permission set.

## EXECUTE grants
- All RPCs revoke from PUBLIC/anon and grant to authenticated/service_role (verified by sampling). Full per-function grant audit is unaudited (442 functions).

## Unaudited (no live DB)
- Actual RLS enforcement behavior (cannot run without a non-production instance; Docker unavailable, so `supabase start` not possible).
- EXECUTE grants on all 442 functions (sampled only).
- Storage buckets: none defined in repo; dashboard not inspected.
- `user_has_permission` callers that may depend on the director bypass (search needed in Phase 12).
