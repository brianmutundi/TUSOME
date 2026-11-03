-- TUSOME analytics: Column-Level Security (Phase 4)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Create restricted views for sensitive tables
-- These views mask sensitive columns based on the user's role.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 2. Add sensitive columns to students table (if not exist)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'medical_notes') THEN
    ALTER TABLE public.students ADD COLUMN medical_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'special_needs') THEN
    ALTER TABLE public.students ADD COLUMN special_needs text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'emergency_contact_phone') THEN
    ALTER TABLE public.students ADD COLUMN emergency_contact_phone text;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_student_safe_profile
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_safe_profile(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_can_view_sensitive BOOLEAN;
  v_student RECORD;
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

  SELECT * INTO v_student
  FROM public.students s
  WHERE s.id = p_student_id
    AND (v_role = 'service_role' OR s.tenant_id = v_caller_tenant);

  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  v_can_view_sensitive := public.user_has_permission(auth.uid(), v_caller_tenant, 'view-sensitive-student-data'::text);

  RETURN jsonb_build_object(
    'student_id', v_student.id,
    'admission_no', v_student.admission_no,
    'full_name', v_student.full_name,
    'gender', v_student.gender,
    'class_id', v_student.class_id,
    'stream_id', v_student.stream_id,
    'medical_notes', CASE WHEN v_can_view_sensitive THEN v_student.medical_notes ELSE NULL END,
    'special_needs', CASE WHEN v_can_view_sensitive THEN v_student.special_needs ELSE NULL END,
    'emergency_contact_phone', CASE WHEN v_can_view_sensitive THEN v_student.emergency_contact_phone ELSE NULL END
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_student_safe_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_safe_profile(uuid) TO authenticated, service_role;
