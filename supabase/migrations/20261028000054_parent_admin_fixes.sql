-- 20261028000054_parent_admin_fixes.sql
--
-- Admin-side parent portal fixes found while reading migration 23.
--
-- 1. get_parents() declared five output columns (including phone) but selected
--    four, and profiles has no phone column, so the call could not succeed.
--    It also listed every profile in the school, not only parents. It now
--    returns the four columns the client type ParentRow expects, only for
--    accounts with the parent role, and requires 'access-students'.
-- 2. unlink_parent_student() had no permission check. It now requires
--    'edit-student-profile'.
-- 3. get_parent_student_links() had no permission check. It now requires
--    'access-students'. Parent-facing reads use get_my_children() (added in a
--    later migration), not this function.
--
-- Parents get no built-in role permissions on purpose. Parent access is
-- granted by a row in parent_student_links, never by a staff permission.
--
-- Not run against a database here.

-- ---------------------------------------------------------------------------
-- 1. get_parents
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_parents();

CREATE FUNCTION public.get_parents()
RETURNS TABLE(
  parent_id uuid,
  full_name text,
  email text,
  linked_students bigint
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    v_caller_tenant := public.assert_permission('access-students');
  END IF;

  RETURN QUERY
  SELECT
    p.id AS parent_id,
    p.full_name,
    p.email,
    (SELECT COUNT(*) FROM public.parent_student_links psl WHERE psl.parent_id = p.id) AS linked_students
  FROM public.profiles p
  WHERE (v_role = 'service_role' OR p.tenant_id = v_caller_tenant)
    AND public.normalize_role_key(p.role) = 'parent'
  ORDER BY p.full_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_parents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_parents() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. unlink_parent_student
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlink_parent_student(p_link_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_deleted INT;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  v_caller_tenant := public.assert_permission('edit-student-profile');

  DELETE FROM public.parent_student_links
  WHERE id = p_link_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.unlink_parent_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlink_parent_student(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. get_parent_student_links
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_parent_student_links(p_student_id uuid DEFAULT NULL, p_parent_id uuid DEFAULT NULL)
RETURNS TABLE(
  link_id uuid,
  parent_id uuid,
  parent_name text,
  parent_email text,
  student_id uuid,
  student_name text,
  admission_no text,
  relationship text,
  is_primary boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    v_caller_tenant := public.assert_permission('access-students');
  END IF;

  RETURN QUERY
  SELECT
    psl.id AS link_id,
    psl.parent_id,
    pp.full_name AS parent_name,
    pp.email AS parent_email,
    psl.student_id,
    s.full_name AS student_name,
    s.admission_no,
    psl.relationship,
    psl.is_primary,
    psl.created_at
  FROM public.parent_student_links psl
  LEFT JOIN public.profiles pp ON pp.id = psl.parent_id
  LEFT JOIN public.students s ON s.id = psl.student_id
  WHERE (v_role = 'service_role' OR psl.tenant_id = v_caller_tenant)
    AND (p_student_id IS NULL OR psl.student_id = p_student_id)
    AND (p_parent_id IS NULL OR psl.parent_id = p_parent_id)
  ORDER BY s.full_name, pp.full_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_parent_student_links(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_parent_student_links(uuid, uuid) TO authenticated, service_role;
