-- TUSOME analytics: Zeraki-parity Classes & Streams Management
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. RPC: get_classes_with_streams
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_classes_with_streams()
RETURNS TABLE(
  class_id uuid,
  class_name text,
  stream_id uuid,
  stream_name text,
  student_count bigint
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
    c.id AS class_id,
    c.name AS class_name,
    s.id AS stream_id,
    s.name AS stream_name,
    (SELECT COUNT(*) FROM public.students st WHERE st.class_id = c.id AND (s.id IS NULL OR st.stream_id = s.id)) AS student_count
  FROM public.classes c
  LEFT JOIN public.streams s ON s.class_id = c.id
  WHERE (v_role = 'service_role' OR c.tenant_id = v_caller_tenant)
  ORDER BY c.name, s.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. RPC: upsert_class
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_class(
  p_name text,
  p_class_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_class_id UUID;
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
    RAISE EXCEPTION 'Class name is required';
  END IF;

  IF p_class_id IS NOT NULL THEN
    UPDATE public.classes SET name = btrim(p_name)
    WHERE id = p_class_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    RETURNING id INTO v_class_id;
  ELSE
    INSERT INTO public.classes (tenant_id, name)
    VALUES (v_caller_tenant, btrim(p_name))
    RETURNING id INTO v_class_id;
  END IF;

  RETURN v_class_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. RPC: upsert_stream
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_stream(
  p_class_id uuid,
  p_name text,
  p_stream_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_stream_id UUID;
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
    RAISE EXCEPTION 'Stream name is required';
  END IF;

  IF p_stream_id IS NOT NULL THEN
    UPDATE public.streams SET name = btrim(p_name)
    WHERE id = p_stream_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    RETURNING id INTO v_stream_id;
  ELSE
    INSERT INTO public.streams (tenant_id, class_id, name)
    VALUES (v_caller_tenant, p_class_id, btrim(p_name))
    RETURNING id INTO v_stream_id;
  END IF;

  RETURN v_stream_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_classes_with_streams() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_class(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_stream(uuid, text, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_classes_with_streams() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_class(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_stream(uuid, text, uuid) TO authenticated, service_role;
