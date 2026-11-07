# Phase 11 — Attack test checklist (NOT RUN)

No non-production Supabase instance is available (Docker missing), so these are documented for execution against a local `supabase start` or dev project. None have been run.

## Unit / integration (Vitest)
- [ ] Cross-tenant read: user from tenant A calls RPC with tenant B's student_id → expect 404/empty, no data leak.
- [ ] Swapped student ID in parent portal: parent A requests parent B's child → assert_parent_of blocks.
- [ ] Unassigned class: teacher without allocation requests marks for that class → denied.
- [ ] Revoked account: effective permissions empty → all gated routes denied.
- [ ] Permission-load failure: AuthGate shows error screen, no protected content.
- [ ] Unregistered route: canAccessRoute returns false (covered by matrix test).
- [ ] Anon key: direct REST call to RPC with anon key → denied by RLS.
- [ ] Multi-role DENY bypass: user with role A (grants X) + role B (grants X) + DENY X → effective excludes X.
- [ ] Director escalation: director cannot write role_permissions/user_permissions (PD-1 migration).
- [ ] user_has_permission director bypass removed (migration 20261108000005).

## Playwright (E2E)
- [ ] URL manipulation: teacher navigates to /analytics/accounts → redirect to /analytics.
- [ ] Tampered browser role metadata: modify app_metadata in client → server still enforces.
- [ ] Self-escalation: user PATCHes own profile.role → blocked by RLS.
- [ ] Unauthorized export/download: direct fetch to PDF route without token → 401/404.
- [ ] Private file access: signed URL scope/expiry.
- [ ] Another parent's child: swap childId in URL → no data.
- [ ] Another school: swap tenant → no data.
- [ ] Permission-load failure screen: block network, verify error + retry.
- [ ] Revoked/expired account: sign in with revoked account → denied.
