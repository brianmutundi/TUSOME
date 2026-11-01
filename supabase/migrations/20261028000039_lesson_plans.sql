-- TUSOME analytics: Lesson Plans & Curriculum Coverage (Phase 3B-C)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Lesson plans table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects (id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL,
  stream_id uuid REFERENCES public.streams (id) ON DELETE SET NULL,
  timetable_entry_id uuid REFERENCES public.timetable_entries (id) ON DELETE SET NULL,
  topic text NOT NULL,
  subtopic text,
  learning_objectives text,
  intended_outcomes text,
  learning_activities text,
  teaching_resources text,
  assessment_methods text,
  teacher_notes text,
  planned_date date,
  duration_minutes integer,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  completion_pct integer DEFAULT 0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_plans_tenant ON public.lesson_plans;
CREATE POLICY lesson_plans_tenant ON public.lesson_plans
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plans TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Curriculum coverage table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.curriculum_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL,
  term text NOT NULL,
  academic_year integer NOT NULL,
  curriculum_topic text NOT NULL,
  curriculum_subtopic text,
  is_planned boolean NOT NULL DEFAULT false,
  is_taught boolean NOT NULL DEFAULT false,
  taught_date date,
  taught_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  lesson_plan_id uuid REFERENCES public.lesson_plans (id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, subject_id, class_id, term, academic_year, curriculum_topic, curriculum_subtopic)
);

ALTER TABLE public.curriculum_coverage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS curriculum_coverage_tenant ON public.curriculum_coverage;
CREATE POLICY curriculum_coverage_tenant ON public.curriculum_coverage
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_coverage TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_lesson_plans
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_lesson_plans(
  p_subject_id uuid DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_teacher_id uuid DEFAULT NULL
)
RETURNS TABLE(
  plan_id uuid,
  teacher_id uuid,
  teacher_name text,
  subject_id uuid,
  subject_name text,
  class_id uuid,
  class_name text,
  stream_id uuid,
  stream_name text,
  topic text,
  subtopic text,
  learning_objectives text,
  intended_outcomes text,
  learning_activities text,
  teaching_resources text,
  assessment_methods text,
  teacher_notes text,
  planned_date date,
  duration_minutes integer,
  status text,
  completion_pct integer,
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
    lp.id AS plan_id,
    lp.teacher_id,
    p.full_name AS teacher_name,
    lp.subject_id,
    s.name AS subject_name,
    lp.class_id,
    c.name AS class_name,
    lp.stream_id,
    st.name AS stream_name,
    lp.topic,
    lp.subtopic,
    lp.learning_objectives,
    lp.intended_outcomes,
    lp.learning_activities,
    lp.teaching_resources,
    lp.assessment_methods,
    lp.teacher_notes,
    lp.planned_date,
    lp.duration_minutes,
    lp.status,
    lp.completion_pct,
    lp.created_at
  FROM public.lesson_plans lp
  LEFT JOIN public.profiles p ON p.id = lp.teacher_id
  LEFT JOIN public.subjects s ON s.id = lp.subject_id
  LEFT JOIN public.classes c ON c.id = lp.class_id
  LEFT JOIN public.streams st ON st.id = lp.stream_id
  WHERE (v_role = 'service_role' OR lp.tenant_id = v_caller_tenant)
    AND (p_subject_id IS NULL OR lp.subject_id = p_subject_id)
    AND (p_class_id IS NULL OR lp.class_id = p_class_id)
    AND (p_teacher_id IS NULL OR lp.teacher_id = p_teacher_id)
  ORDER BY lp.planned_date DESC, lp.created_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: create_lesson_plan
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_lesson_plan(
  p_topic text,
  p_subject_id uuid DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_stream_id uuid DEFAULT NULL,
  p_teacher_id uuid DEFAULT NULL,
  p_timetable_entry_id uuid DEFAULT NULL,
  p_subtopic text DEFAULT NULL,
  p_learning_objectives text DEFAULT NULL,
  p_intended_outcomes text DEFAULT NULL,
  p_learning_activities text DEFAULT NULL,
  p_teaching_resources text DEFAULT NULL,
  p_assessment_methods text DEFAULT NULL,
  p_teacher_notes text DEFAULT NULL,
  p_planned_date date DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_plan_id UUID;
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

  IF btrim(coalesce(p_topic, '')) = '' THEN
    RAISE EXCEPTION 'Topic is required';
  END IF;

  INSERT INTO public.lesson_plans (tenant_id, teacher_id, subject_id, class_id, stream_id, timetable_entry_id, topic, subtopic, learning_objectives, intended_outcomes, learning_activities, teaching_resources, assessment_methods, teacher_notes, planned_date, duration_minutes)
  VALUES (v_caller_tenant, p_teacher_id, p_subject_id, p_class_id, p_stream_id, p_timetable_entry_id, btrim(p_topic), nullif(btrim(coalesce(p_subtopic, '')), ''), nullif(btrim(coalesce(p_learning_objectives, '')), ''), nullif(btrim(coalesce(p_intended_outcomes, '')), ''), nullif(btrim(coalesce(p_learning_activities, '')), ''), nullif(btrim(coalesce(p_teaching_resources, '')), ''), nullif(btrim(coalesce(p_assessment_methods, '')), ''), nullif(btrim(coalesce(p_teacher_notes, '')), ''), p_planned_date, p_duration_minutes)
  RETURNING id INTO v_plan_id;

  RETURN v_plan_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: update_lesson_plan_status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_lesson_plan_status(
  p_plan_id uuid,
  p_status text,
  p_completion_pct integer DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_updated INT;
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

  IF p_status NOT IN ('planned', 'in_progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  IF p_completion_pct < 0 OR p_completion_pct > 100 THEN
    RAISE EXCEPTION 'Completion percentage must be between 0 and 100';
  END IF;

  UPDATE public.lesson_plans SET
    status = p_status,
    completion_pct = p_completion_pct,
    updated_at = now()
  WHERE id = p_plan_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_curriculum_coverage
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_curriculum_coverage(
  p_subject_id uuid DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_term text DEFAULT NULL,
  p_academic_year integer DEFAULT NULL
)
RETURNS TABLE(
  coverage_id uuid,
  subject_id uuid,
  subject_name text,
  class_id uuid,
  class_name text,
  term text,
  academic_year integer,
  curriculum_topic text,
  curriculum_subtopic text,
  is_planned boolean,
  is_taught boolean,
  taught_date date,
  taught_by_name text,
  notes text
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
    cc.id AS coverage_id,
    cc.subject_id,
    s.name AS subject_name,
    cc.class_id,
    c.name AS class_name,
    cc.term,
    cc.academic_year,
    cc.curriculum_topic,
    cc.curriculum_subtopic,
    cc.is_planned,
    cc.is_taught,
    cc.taught_date,
    p.full_name AS taught_by_name,
    cc.notes
  FROM public.curriculum_coverage cc
  LEFT JOIN public.subjects s ON s.id = cc.subject_id
  LEFT JOIN public.classes c ON c.id = cc.class_id
  LEFT JOIN public.profiles p ON p.id = cc.taught_by
  WHERE (v_role = 'service_role' OR cc.tenant_id = v_caller_tenant)
    AND (p_subject_id IS NULL OR cc.subject_id = p_subject_id)
    AND (p_class_id IS NULL OR cc.class_id = p_class_id)
    AND (p_term IS NULL OR cc.term = p_term)
    AND (p_academic_year IS NULL OR cc.academic_year = p_academic_year)
  ORDER BY cc.subject_id, cc.curriculum_topic, cc.curriculum_subtopic;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: upsert_curriculum_coverage
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_curriculum_coverage(
  p_subject_id uuid,
  p_term text,
  p_academic_year integer,
  p_curriculum_topic text,
  p_class_id uuid DEFAULT NULL,
  p_curriculum_subtopic text DEFAULT NULL,
  p_is_planned boolean DEFAULT false,
  p_is_taught boolean DEFAULT false,
  p_taught_date date DEFAULT NULL,
  p_lesson_plan_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_coverage_id UUID;
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

  IF btrim(coalesce(p_curriculum_topic, '')) = '' THEN
    RAISE EXCEPTION 'Curriculum topic is required';
  END IF;

  INSERT INTO public.curriculum_coverage (tenant_id, subject_id, class_id, term, academic_year, curriculum_topic, curriculum_subtopic, is_planned, is_taught, taught_date, taught_by, lesson_plan_id, notes)
  VALUES (v_caller_tenant, p_subject_id, p_class_id, p_term, p_academic_year, btrim(p_curriculum_topic), nullif(btrim(coalesce(p_curriculum_subtopic, '')), ''), p_is_planned, p_is_taught, p_taught_date, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END, p_lesson_plan_id, nullif(btrim(coalesce(p_notes, '')), ''))
  ON CONFLICT (tenant_id, subject_id, class_id, term, academic_year, curriculum_topic, curriculum_subtopic) DO UPDATE SET
    is_planned = EXCLUDED.is_planned,
    is_taught = EXCLUDED.is_taught,
    taught_date = EXCLUDED.taught_date,
    taught_by = EXCLUDED.taught_by,
    lesson_plan_id = EXCLUDED.lesson_plan_id,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_coverage_id;

  RETURN v_coverage_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. RPC: get_curriculum_coverage_summary
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_curriculum_coverage_summary(
  p_subject_id uuid DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_term text DEFAULT NULL,
  p_academic_year integer DEFAULT NULL
)
RETURNS TABLE(
  subject_id uuid,
  subject_name text,
  class_id uuid,
  class_name text,
  total_topics bigint,
  planned_topics bigint,
  taught_topics bigint,
  coverage_pct numeric
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
    cc.subject_id,
    s.name AS subject_name,
    cc.class_id,
    c.name AS class_name,
    COUNT(*) AS total_topics,
    COUNT(*) FILTER (WHERE cc.is_planned = true) AS planned_topics,
    COUNT(*) FILTER (WHERE cc.is_taught = true) AS taught_topics,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(COUNT(*) FILTER (WHERE cc.is_taught = true)::numeric / COUNT(*)::numeric * 100, 1)
    END AS coverage_pct
  FROM public.curriculum_coverage cc
  LEFT JOIN public.subjects s ON s.id = cc.subject_id
  LEFT JOIN public.classes c ON c.id = cc.class_id
  WHERE (v_role = 'service_role' OR cc.tenant_id = v_caller_tenant)
    AND (p_subject_id IS NULL OR cc.subject_id = p_subject_id)
    AND (p_class_id IS NULL OR cc.class_id = p_class_id)
    AND (p_term IS NULL OR cc.term = p_term)
    AND (p_academic_year IS NULL OR cc.academic_year = p_academic_year)
  GROUP BY cc.subject_id, s.name, cc.class_id, c.name
  ORDER BY s.name, c.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_lesson_plans(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_lesson_plan(text, uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, date, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_lesson_plan_status(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_curriculum_coverage(uuid, uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_curriculum_coverage(uuid, text, integer, text, uuid, text, boolean, boolean, date, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_curriculum_coverage_summary(uuid, uuid, text, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_lesson_plans(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_lesson_plan(text, uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, date, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_lesson_plan_status(uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_curriculum_coverage(uuid, uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_curriculum_coverage(uuid, text, integer, text, uuid, text, boolean, boolean, date, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_curriculum_coverage_summary(uuid, uuid, text, integer) TO authenticated, service_role;
