-- TUSOME analytics: Zeraki-parity Exam Comment System
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Comment categories table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comment_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  category_type text NOT NULL DEFAULT 'general' CHECK (category_type IN ('general', 'exam_group', 'principal', 'stream', 'residence', 'student')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comment_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comment_categories_tenant ON public.comment_categories;
CREATE POLICY comment_categories_tenant ON public.comment_categories
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_categories TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Exam comments table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  exam_id uuid REFERENCES public.exams (id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.students (id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.comment_categories (id) ON DELETE SET NULL,
  comment_text text NOT NULL,
  comment_type text NOT NULL DEFAULT 'general' CHECK (comment_type IN ('general', 'principal', 'teacher', 'stream', 'residence')),
  target_type text NOT NULL DEFAULT 'student' CHECK (target_type IN ('student', 'class', 'stream', 'school')),
  target_id uuid,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exam_comments_tenant ON public.exam_comments;
CREATE POLICY exam_comments_tenant ON public.exam_comments
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_comments TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_exam_comments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_exam_comments(p_exam_id uuid DEFAULT NULL, p_student_id uuid DEFAULT NULL)
RETURNS TABLE(
  comment_id uuid,
  exam_id uuid,
  exam_name text,
  student_id uuid,
  student_name text,
  category_name text,
  comment_text text,
  comment_type text,
  target_type text,
  created_by_name text,
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
    ec.id AS comment_id,
    ec.exam_id,
    e.name AS exam_name,
    ec.student_id,
    s.full_name AS student_name,
    cc.name AS category_name,
    ec.comment_text,
    ec.comment_type,
    ec.target_type,
    p.full_name AS created_by_name,
    ec.created_at
  FROM public.exam_comments ec
  LEFT JOIN public.exams e ON e.id = ec.exam_id
  LEFT JOIN public.students s ON s.id = ec.student_id
  LEFT JOIN public.comment_categories cc ON cc.id = ec.category_id
  LEFT JOIN public.profiles p ON p.id = ec.created_by
  WHERE (v_role = 'service_role' OR ec.tenant_id = v_caller_tenant)
    AND (p_exam_id IS NULL OR ec.exam_id = p_exam_id)
    AND (p_student_id IS NULL OR ec.student_id = p_student_id)
  ORDER BY ec.created_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: add_exam_comment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_exam_comment(
  p_exam_id uuid DEFAULT NULL,
  p_student_id uuid DEFAULT NULL,
  p_comment_text text DEFAULT '',
  p_comment_type text DEFAULT 'general',
  p_target_type text DEFAULT 'student',
  p_target_id uuid DEFAULT NULL,
  p_category_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_comment_id UUID;
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

  IF btrim(coalesce(p_comment_text, '')) = '' THEN
    RAISE EXCEPTION 'Comment text is required';
  END IF;

  INSERT INTO public.exam_comments (tenant_id, exam_id, student_id, category_id, comment_text, comment_type, target_type, target_id, created_by)
  VALUES (v_caller_tenant, p_exam_id, p_student_id, p_category_id, btrim(p_comment_text), p_comment_type, p_target_type, p_target_id, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: get_comment_categories
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_comment_categories(p_category_type text DEFAULT NULL)
RETURNS TABLE(
  category_id uuid,
  name text,
  category_type text,
  description text
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
    cc.id AS category_id,
    cc.name,
    cc.category_type,
    cc.description
  FROM public.comment_categories cc
  WHERE (v_role = 'service_role' OR cc.tenant_id = v_caller_tenant)
    AND (p_category_type IS NULL OR cc.category_type = p_category_type)
  ORDER BY cc.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_exam_comments(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_exam_comment(uuid, uuid, text, text, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_comment_categories(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_exam_comments(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_exam_comment(uuid, uuid, text, text, text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_comment_categories(text) TO authenticated, service_role;
