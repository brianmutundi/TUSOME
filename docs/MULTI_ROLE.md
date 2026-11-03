# Multi-role model

## Current state (Batch 3 complete)

- `public.user_roles` stores additional roles per user per tenant. It is additive;
  `profiles.role` remains the primary role.
- **The junction table now grants permissions.** `get_user_permission_profile`
  returns the UNION of the primary role and every `user_roles` row for that user
  in that tenant. `user_has_permission` uses the same union and applies the
  admin-level bypass if ANY assigned role is admin/owner/principal/director/super admin.
- Custom tenant roles win over the built-in catalog for that role key; built-in
  roles fall back to `default_role_catalog()`. User GRANT/DENY overrides still apply
  after the role union (DENY always wins).
- Removing one `user_roles` row removes only that role's contribution; the primary
  role and remaining additional roles are unaffected.

Evidence: `supabase/tests/multi_role_union.sql` — 12 assertions covering
teacher+DOS, custom+built-in, and role removal. All pass.

## Assignment surface

There is **no UI or API path that assigns an extra role** through `user_roles`.
Writes are possible only for tenant admins directly against the table under RLS
(`user_roles_insert` / `user_roles_delete` require an admin-level primary role in
the same tenant). This is enforced by the committed test
`src/lib/analytics/multiRoleAssignment.test.ts`, which fails if any `src` file
references `user_roles`, `assign_user_role`, or `grant_user_role`.

Before adding an assignment UI/API, the route guard and permission catalog must be
reviewed so that newly granted roles cannot widen access unintentionally.
