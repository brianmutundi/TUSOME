-- TUSOME analytics: Zeraki-parity Subjects Management
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- Ensure subjects table has required columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subjects' AND column_name = 'department') THEN
    ALTER TABLE public.subjects ADD COLUMN department text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subjects' AND column_name = 'is_compulsory') THEN
    ALTER TABLE public.subjects ADD COLUMN is_compulsory boolean DEFAULT false;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. RPC: get_subjects_with_details
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_subjects_with_details()
RETURNS TABLE(
  subject_id uuid,
  subject_name text,
  subject_code text,
  department text,
  is_compulsory boolean,
  paper_count bigint
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
    s.id AS subject_id,
    s.name AS subject_name,
    s.code AS subject_code,
    COALESCE(s.department, 'General') AS department,
    COALESCE(s.is_compulsory, false) AS is_compulsory,
    (SELECT COUNT(*) FROM public.subject_papers sp WHERE sp.subject_id = s.id) AS paper_count
  FROM public.subjects s
  WHERE (v_role = 'service_role' OR s.tenant_id = v_caller_tenant)
  ORDER BY s.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. RPC: upsert_subject
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_subject(
  p_name text,
  p_code text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_is_compulsory boolean DEFAULT false,
  p_subject_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_subject_id UUID;
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

  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Subject name is required';
  END IF;

  IF p_subject_id IS NOT NULL THEN
    UPDATE public.subjects SET
      name = btrim(p_name),
      code = nullif(btrim(coalesce(p_code, '')), ''),
      department = nullif(btrim(coalesce(p_department, '')), ''),
      is_compulsory = p_is_compulsory
    WHERE id = p_subject_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    RETURNING id INTO v_subject_id;
  ELSE
    INSERT INTO public.subjects (tenant_id, name, code, department, is_compulsory)
    VALUES (v_caller_tenant, btrim(p_name), nullif(btrim(coalesce(p_code, '')), ''), nullif(btrim(coalesce(p_department, '')), ''), p_is_compulsory)
    RETURNING id INTO v_subject_id;
  END IF;

  RETURN v_subject_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_subjects_with_details() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_subject(text, text, text, boolean, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_subjects_with_details() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_subject(text, text, text, boolean, uuid) TO authenticated, service_role;
