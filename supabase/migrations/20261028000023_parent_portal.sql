-- TUSOME analytics: Zeraki-parity Parent Portal (Admin Side)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Zeraki bundle evidence
-- ----------------------
-- 1. Parent routes (route_tree.tsv):
--      * /main/parent
--      * /main/dashboard/welcome/student
--      * /main/students/prof/:id/linked-accounts
--      * /main/students/prof/:id/notes
-- 2. Linked accounts feature allows parents to be linked to students.

-- ---------------------------------------------------------------------------
-- 1. Parent-student links table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'parent' CHECK (relationship IN ('parent', 'guardian', 'mother', 'father', 'sponsor', 'other')),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);

ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parent_student_links_tenant ON public.parent_student_links;
CREATE POLICY parent_student_links_tenant ON public.parent_student_links
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_student_links TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. RPC: get_parent_student_links
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
    BEGIN
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_tenant := NULL;
    END;

    IF v_caller_tenant IS NULL THEN
      RAISE EXCEPTION 'Missing tenant claim';
    END IF;
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

-- ---------------------------------------------------------------------------
-- 3. RPC: link_parent_student
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_parent_student(
  p_parent_id uuid,
  p_student_id uuid,
  p_relationship text DEFAULT 'parent',
  p_is_primary boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_link_id UUID;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  BEGIN
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;
  END;

  IF v_caller_tenant IS NULL THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  INSERT INTO public.parent_student_links (tenant_id, parent_id, student_id, relationship, is_primary)
  VALUES (v_caller_tenant, p_parent_id, p_student_id, p_relationship, p_is_primary)
  ON CONFLICT (parent_id, student_id) DO UPDATE SET
    relationship = EXCLUDED.relationship,
    is_primary = EXCLUDED.is_primary
  RETURNING id INTO v_link_id;

  RETURN v_link_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: unlink_parent_student
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

  BEGIN
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;
  END;

  IF v_caller_tenant IS NULL THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  DELETE FROM public.parent_student_links
  WHERE id = p_link_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: get_parents
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_parents()
RETURNS TABLE(
  parent_id uuid,
  full_name text,
  email text,
  phone text,
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
    BEGIN
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_tenant := NULL;
    END;

    IF v_caller_tenant IS NULL THEN
      RAISE EXCEPTION 'Missing tenant claim';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    p.id AS parent_id,
    p.full_name,
    p.email,
    (SELECT COUNT(*) FROM public.parent_student_links psl WHERE psl.parent_id = p.id) AS linked_students
  FROM public.profiles p
  WHERE (v_role = 'service_role' OR p.tenant_id = v_caller_tenant)
  ORDER BY p.full_name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_parent_student_links(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_parent_student(uuid, uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unlink_parent_student(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_parents() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_parent_student_links(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_parent_student(uuid, uuid, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlink_parent_student(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_parents() TO authenticated, service_role;
