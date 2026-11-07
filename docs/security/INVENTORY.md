# TUSOME Security Inventory

Phase 1 deliverable. No code changes. All facts taken from the actual code and migrations on disk (commit 2a361d7).

## 1. Roles and custom-role mechanism

Source: `supabase/migrations/20261028000006_accounts_directory_rpc.sql` (roles, role_permissions, user_permissions, normalize_role_key, default_role_catalog, get_user_permission_profile).

- `profiles` carries `role` (text) and `staff_type` (TEACHER/OFFICIAL/WORKER). `normalize_role_key()` lowercases and collapses whitespace/hyphens/underscores.
- `roles` table: tenant-scoped custom roles (key, display_name, description, staff_type, scope GLOBAL|CUSTOM, permissions_customized).
- `role_permissions`: (role_id, permission_code) — grants attached to a role.
- `user_permissions`: (user_id, tenant_id, permission_code, effect GRANT|DENY) — per-user overrides.
- Standard roles seeded by `default_role_catalog()`:
  - `admin` / `principal` — all permission codes.
  - `deputy principal`, `director`, `secretary`, `teacher`, `worker`, plus `super admin` (platform, via app_metadata).
  - Custom roles created per tenant via `create_custom_role` / `update_custom_role_permissions`.
- Effective permissions = role_permissions of the user's primary role (plus additional/custom roles if assigned) ∪ user_permissions GRANT − user_permissions DENY. Enforced in `get_user_permission_profile()`.
- `user_has_permission()` / `my_tenant_id()` / `get_user_permission_profile()` are the RPC entry points.
- Platform super-admin is identified by `app_metadata.is_platform_owner === true || app_metadata.role === 'platform_owner'` (AuthGate.tsx:16-19). Restricted to `/analytics/schools`.

## 2. Permission codes

62 codes (from routePermissions.ts + migrations). Categories: access-* (students, exams, subjects, classes, teachers, staff, settings), view/edit/manage-*, approve-*, delete-*, view-*-dashboard, manage-retention, can-manage-user-permissions, view-user-roles, edit-user-roles, edit-teacher-profile, add-teachers, add-students, move-students, search-student, view-student-profile, view-student-analysis, view-sensitive-student-data, edit-student-profile, edit-student-groups, add-edit-student-residences, assign-subject-teachers, assign-class-teachers, assign-class-supervisors, view-my-classes, view-class-list, view-teacher-list, view-teacher-profile, view-staff-bom-pa-list, access-staff-bom-pa, edit-staff-bom-pa, delete-staff-bom-pa, delete-teachers, delete-classes, delete-exam, delete-stream-results, delete-students, manage-classes, manage-exams, create-edit-exam, view-edit-grading-system, view-edit-compulsory-subjects, view-edit-paper-ratios, view-edit-coefficient-system, edit-term-dates, view-term-dates, view-school-profile, edit-school-profile, view-school-options, edit-school-options, access-printouts, view-merit-list, view-evaluation-report, view-report-forms, view-class-list, view-printout-filters, view-transcripts, view-assessments, view-secretary-dashboard, view-teacher-dashboard, view-student-dashboard, view-admin-dashboard, manage-timetable, manage-homework, manage-messages, manage-fees, view-fees, approve-fee-waiver, manage-payroll, approve-payroll, finalize-payroll, manage-retention, compose-send-sms, reply-parent-messages, manage-retention.

## 3. Routes (src/app)

86 page.tsx routes. AuthGate wraps `/analytics/*`. `/parent/*` has its own ParentGate. `/login`, `/receipt/[token]`, `/report/[token]`, `/statement/[token]` are public/token-based.

Route guard registry: `src/lib/analytics/routePermissions.ts` — ROUTE_GUARDS array, canAccessRoute(). Unknown routes return true (gap). Empty anyOf returns true (any authenticated). Super admin restricted to /analytics/schools in AuthGate.

## 4. Nav items

`src/components/shell/nav.ts`: HOME_ITEM + 9 NAV_GROUPS (students, academics, attendance, staff, finance, communication, operations, reports, admin) = ~60 items. navGroupsForRole filters groups/items by canAccessRoute. searchEntriesForRole filters by allowed set.

## 5. API endpoints (Next route handlers)

7 routes under src/app/api: pdf, receipt/[token]/pdf, receipts/[receiptId]/pdf, statement/[token]/pdf, finance/statement/[studentId]/pdf, trips/[tripId]/permission-slip/[studentId]/pdf, schools (GET? no — POST/DELETE).

All others are direct Supabase RPC calls from the browser via src/lib/analytics/api.ts and src/features/*/api/*Api.ts (~324 .rpc/.from calls).

## 6. Server actions

None (`'use server'` not used). All mutations go through Supabase RPCs or Next route handlers.

## 7. RPCs

442 `CREATE FUNCTION` definitions across supabase/migrations. Many SECURITY DEFINER with search_path. EXECUTE grants to authenticated/service_role. Key ones: get_user_permission_profile, normalize_role_key, default_role_catalog, create_custom_role, update_custom_role_permissions, platform_create_school, delete_school, record_fee_payment, get_fee_payments, etc.

## 8. Tables (RLS)

Core: tenants, profiles, roles, role_permissions, user_permissions, section_heads, permissions, students, classes, streams, subjects, exams, marks, attendance, fees, payments, receipts, etc. RLS enabled on role_permissions, user_permissions (verified). Need full audit of all tables — see Phase 8.

## 9. Storage buckets

None defined in migrations or src. No storage usage found. (Unaudited: Supabase dashboard buckets not visible in repo.)

## 10. Existing authorization checks

- AuthGate: session check, platform owner redirect, parent redirect, canAccessRoute redirect, subscription gate.
- navGroupsForRole: filters nav by permissions.
- RPCs: tenant claim check (Missing tenant claim), role checks (super admin).
- RLS policies on role_permissions, user_permissions.
- Client-side permission arrays passed to AppShell.

## Known gaps (to be addressed in later phases)

- canAccessRoute returns true for unknown routes (should fail closed).
- Empty anyOf returns true (any authenticated) — may be intentional for shared pages but needs review.
- Super admin restricted only in AuthGate (client); server/RPC must also enforce.
- No server-side route handler authorization on most RPCs (rely on RLS + RPC internal checks).
- No storage buckets in repo (dashboard-only, unaudited).
