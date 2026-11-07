# TUSOME Policy Decisions and Phase 2 Findings

## Phase 2 — Permission engine audit

### Effective permission computation
Source: `supabase/migrations/20261028000082_multi_role_permission_union.sql` (current definition of `get_user_permission_profile`).

Pipeline:
1. Load profile (id, tenant_id, role, staff_type, is_active, access_revoked).
2. Tenant isolation: caller tenant must match target tenant (service_role bypasses).
3. Role permissions = UNION of primary role (`role_permissions_for(tenant, primary role)`) and every additional role in `user_roles` for that user/tenant.
4. GRANT overrides (user_permissions effect=GRANT) and DENY overrides (effect=DENY) collected per user/tenant.
5. If `access_revoked OR NOT is_active` → effective = [] (fail closed).
6. Otherwise effective = permissions where (code in role_perms OR code in granted) AND code NOT in denied.

### Findings

| # | Area | Finding | Severity | Status |
|---|------|---------|----------|--------|
| 1 | DENY enforcement | DENY is applied last (`NOT (pm.code = ANY(v_denied))`), after role union and GRANT. A denied code cannot be re-granted by an additional role or a GRANT override. Correct. | — | OK |
| 2 | Multi-role union | Effective = union of primary + user_roles. DENY still wins. Correct, provided role_permissions_for resolves custom tenant roles first then built-in catalog. | — | OK |
| 3 | Revoked/inactive | get_user_permission_profile returns empty effective array. Server/RPCs that call it get no permissions. | — | OK (server) |
| 4 | Client permission-load failure | AuthGate `.catch(() => {})` leaves `me` null and continues rendering. Routes with empty `anyOf` (many pages) stay accessible; inactive/revoked not checked client-side. Server enforces, but UI fails open-ish. | Medium | Fix in Phases 5/7 |
| 5 | RLS write gate (role_permissions, user_permissions) | Write policies check `me.role` is in a hardcoded role-name list (admin, principal, director, owner, super admin), not the `can-manage-user-permissions` permission code. A director (limited permission set) can grant permissions they themselves lack. | High | Policy decision below |
| 6 | Platform vs school admin | Separated via app_metadata (platform) vs profiles.role (school admin). AuthGate redirects platform owners to /analytics/schools. Client-only guard on that route. | Medium | Verify server-side in Phase 7/8 |
| 7 | Self-escalation on profiles.role | Need to confirm RLS prevents users from updating their own role/tenant. Not verified yet. | High | Phase 8 |
| 8 | Missing permission loading → deny | AuthGate redirects guarded routes (non-empty anyOf) on failure; empty-anyOf routes remain open. | Medium | Phase 5 |

### Policy decisions requiring your input

#### PD-1: Who may manage user permissions and roles?
Current RLS allows anyone whose `profiles.role` normalizes to admin/administrator/superadmin/super_admin/super admin/owner/principal/director to write `role_permissions` and `user_permissions`. This is role-name based, not permission-based.

Options:
- A (recommended): Gate writes on the `can-manage-user-permissions` permission code (and `edit-user-roles`), so only roles holding those codes can manage. Additionally verify the granting admin holds every code being granted (no escalation).
- B: Keep role-name list but remove `director` (least privilege; directors get a limited catalog).
- C: Leave as-is (current behavior).

Recommendation: A. It closes the director escalation path and aligns with the permission catalogue.

#### PD-2: Should permission-load failure block all routes?
Current: guarded routes (non-empty anyOf) redirect; empty-anyOf routes render.

Options:
- A (recommended): On permission-load failure, deny all protected routes and show an error/retry screen. Fail closed.
- B: Keep current (some pages usable while permissions load).

Recommendation: A.

#### PD-3: Empty `anyOf` arrays in the route registry
Current: `canAccessRoute` treats `anyOf: []` as "any authenticated user may view". ~30 routes use this (lesson-plans, daily-attendance, events, library, etc.).

Options:
- A: Replace every empty array with an explicit permission code (or a sentinel `access-general` code added via migration). Most correct but requires a per-route permission decision; risk of guessing.
- B (recommended, interim): Keep empty-as-authenticated but treat the registry as an explicit allowlist of authenticated routes; document each empty route as needing a permission code. No behavior change now.
- C: Flip empty to deny immediately — would break ~30 pages.

Recommendation: B now; migrate empties to explicit codes in Phase 6 with your input per route. Marked NEEDS DECISION per route in the matrix (Phase 11).

### Unaudited
- Whether profiles.role/tenant_id are protected by RLS from self-update (Phase 8).
- RPC-level enforcement for get_schools, platform_create_school, delete_school (Phase 7/8).
- Whether AuthGate's subscription gate fails closed on error (it sets subBlocked null on catch — fail open; noted).
