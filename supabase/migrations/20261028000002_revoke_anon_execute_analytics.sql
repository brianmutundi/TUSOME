-- TUSOME analytics: narrower EXECUTE grants (remove anonymous access)
--
-- STATUS: PROPOSED — repository-only. NOT applied to any database, and
-- specifically NOT applied to production. Requires owner approval; see
-- supabase/tests/STAGING_VALIDATION_REPORT.md.
--
-- Why this exists
-- ---------------
-- 20261028000000 and 20261028000001 GRANT EXECUTE to authenticated and
-- service_role, but neither REVOKEs PostgreSQL's default
-- EXECUTE ... TO PUBLIC. Every role therefore inherits EXECUTE, including
-- anon, so the analytics RPCs are callable by anonymous traffic.
--
-- The functions still fail closed today: an anon JWT carries no tenant_id, so
-- auth.jwt() ->> 'tenant_id' is NULL and every RPC raises 'Missing tenant
-- claim'. The tests assert that behaviour. However no intended flow uses these
-- RPCs anonymously: the analytics dashboard and report card are signed-in
-- screens, and a report link cannot be shared without an authenticated tenant
-- claim. The narrowest correct privilege set is therefore
-- {authenticated, service_role}.
--
-- What this does
-- --------------
-- 1. Removes the implicit PUBLIC grant (from which anon inherited).
-- 2. Removes any direct anon grant, in case one was added out of band.
-- 3. Re-asserts the two intended grants, so this file is safe to run on its
--    own and idempotent.
--
-- It does NOT change function bodies, signatures, volatility, security
-- definer, ownership, tenant guards, or the pass mark.
--
-- Rollback
-- --------
--   GRANT EXECUTE ON FUNCTION ... TO PUBLIC;
-- or re-apply 20261028000000, which DROPs and recreates the five functions and
-- restores the PostgreSQL default. Either way, re-apply this file afterwards,
-- because recreating a function resets its ACL to the default PUBLIC grant.
--
-- SECURITY INVOKER note
-- ---------------------
-- All five functions are SECURITY INVOKER, so they execute with the caller's
-- privileges. authenticated and service_role hold explicit EXECUTE on every
-- function they can reach (including get_grade_for_score, called internally),
-- so revoking PUBLIC does not break any supported call path. Verified on
-- disposable PostgreSQL 17 with the four analytics suites.

REVOKE EXECUTE ON FUNCTION public.get_grade_for_score(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_class_performance(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_grade_distribution(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_student_report_data(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_subject_performance(uuid, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_grade_for_score(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_performance(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_grade_distribution(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_report_data(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subject_performance(uuid, uuid, uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_grade_for_score(uuid, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_class_performance(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_grade_distribution(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_student_report_data(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_subject_performance(uuid, uuid, uuid) TO service_role;
