-- TUSOME analytics: Per-Subject Publish & Subject Teacher Access
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Zeraki bundle evidence
-- ----------------------
-- 1. PublishStatusComponent (chunk-RMCHKSBZ.js):
--      * textAllHaveMarks / textDontHaveMarks / textAllHaveNoResults
--      * btnTextPublish / btnTextUpload / btnTextView / btnTextCancel
--      * btnTextGrantAccessToTeachers / textSeletSubjectAccess
--      * linkTextDeleteResults / linkTextDownloadResults
--      * textSubjectsWithIndividualPaperResults / textPublishAllPapers
-- 2. PublishExamsComponent (chunk-E2VI6NTQ.js):
--      * publishSeries() / grantSubjectTeacherAccess()
-- 3. ManageExamComponent (chunk-372RFQAZ.js):
--      * btnTextPublishResults / btnTextUnpublishResults / btnTextReleaseExam

-- ---------------------------------------------------------------------------
-- 1. Per-subject publish status table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subject_publish_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
  published boolean NOT NULL DEFAULT false,
  published_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, subject_id)
);

ALTER TABLE public.subject_publish_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subject_publish_status_tenant ON public.subject_publish_status;
CREATE POLICY subject_publish_status_tenant ON public.subject_publish_status
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_publish_status TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Subject teacher access grants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subject_teacher_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, subject_id, teacher_id)
);

ALTER TABLE public.subject_teacher_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subject_teacher_access_tenant ON public.subject_teacher_access;
CREATE POLICY subject_teacher_access_tenant ON public.subject_teacher_access
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_teacher_access TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. get_subject_publish_status: per-subject publish status for an exam
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_subject_publish_status(p_exam_id uuid)
RETURNS TABLE(
  subject_id uuid,
  subject_name text,
  subject_code text,
  enrolled_students integer,
  recorded_marks integer,
  missing_marks integer,
  mean_score numeric,
  published boolean,
  published_at timestamptz,
  teacher_access_granted boolean
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_exam_tenant UUID;
  v_caller_tenant UUID;
  v_role TEXT;
  v_cohort_count INT;
BEGIN
  SELECT e.tenant_id INTO v_exam_tenant
  FROM public.exams e
  WHERE e.id = p_exam_id;

  IF v_exam_tenant IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

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

    IF v_exam_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to exam from different tenant';
    END IF;
  END IF;

  WITH latest_enrollment AS (
    SELECT DISTINCT ON (se.student_id)
      se.student_id,
      se.class_id
    FROM public.student_enrollments se
    WHERE se.tenant_id = v_exam_tenant
    ORDER BY se.student_id, se.academic_year DESC, se.created_at DESC
  ),
  exam_cids AS (
    SELECT ec.class_id FROM public.exam_classes ec WHERE ec.exam_id = p_exam_id
  )
  SELECT count(*)::integer INTO v_cohort_count
  FROM public.students s
  LEFT JOIN latest_enrollment le ON le.student_id = s.id
  WHERE s.tenant_id = v_exam_tenant
    AND (
      NOT EXISTS (SELECT 1 FROM exam_cids)
      OR COALESCE(le.class_id, s.class_id) IN (SELECT ec.class_id FROM exam_cids ec)
    );

  RETURN QUERY
  SELECT
    sub.id AS subject_id,
    sub.name AS subject_name,
    COALESCE(sub.code, '') AS subject_code,
    v_cohort_count AS enrolled_students,
    count(m.id)::integer AS recorded_marks,
    GREATEST(v_cohort_count - count(m.id)::integer, 0)::integer AS missing_marks,
    COALESCE(ROUND(AVG(m.score), 2), 0)::numeric AS mean_score,
    COALESCE(sps.published, false) AS published,
    sps.published_at,
    EXISTS (
      SELECT 1 FROM public.subject_teacher_access sta
      WHERE sta.exam_id = p_exam_id
        AND sta.subject_id = sub.id
        AND sta.teacher_id = auth.uid()
    ) AS teacher_access_granted
  FROM public.subjects sub
  LEFT JOIN public.marks m
    ON m.subject_id = sub.id
   AND m.exam_id = p_exam_id
  LEFT JOIN public.subject_publish_status sps
    ON sps.exam_id = p_exam_id
   AND sps.subject_id = sub.id
  WHERE sub.tenant_id = v_exam_tenant
  GROUP BY sub.id, sub.name, sub.code, sps.published, sps.published_at
  ORDER BY sub.name, sub.id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. publish_subject: publish/unpublish a single subject's results
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_subject(
  p_exam_id uuid,
  p_subject_id uuid,
  p_published boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_exam_tenant UUID;
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_has_marks BOOLEAN;
BEGIN
  SELECT e.tenant_id INTO v_exam_tenant
  FROM public.exams e
  WHERE e.id = p_exam_id;

  IF v_exam_tenant IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

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

    IF v_exam_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to exam from different tenant';
    END IF;

    -- Check if user is admin or has subject teacher access
    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT v_is_admin AND NOT EXISTS (
      SELECT 1 FROM public.subject_teacher_access sta
      WHERE sta.exam_id = p_exam_id
        AND sta.subject_id = p_subject_id
        AND sta.teacher_id = auth.uid()
        AND sta.tenant_id = v_caller_tenant
    ) THEN
      RAISE EXCEPTION 'Access denied: administrator or subject teacher access required';
    END IF;
  END IF;

  -- Check if subject has marks before publishing
  IF p_published THEN
    SELECT EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.exam_id = p_exam_id
        AND m.subject_id = p_subject_id
        AND m.tenant_id = v_exam_tenant
    ) INTO v_has_marks;

    IF NOT v_has_marks THEN
      RAISE EXCEPTION 'Cannot publish subject: no marks have been entered';
    END IF;
  END IF;

  INSERT INTO public.subject_publish_status (tenant_id, exam_id, subject_id, published, published_by, published_at)
  VALUES (
    v_exam_tenant, p_exam_id, p_subject_id, p_published,
    CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END,
    CASE WHEN p_published THEN now() ELSE NULL END
  )
  ON CONFLICT (exam_id, subject_id) DO UPDATE SET
    published = EXCLUDED.published,
    published_by = EXCLUDED.published_by,
    published_at = EXCLUDED.published_at;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. grant_subject_teacher_access: grant a teacher access to publish a subject
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_subject_teacher_access(
  p_exam_id uuid,
  p_subject_id uuid,
  p_teacher_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_exam_tenant UUID;
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
BEGIN
  SELECT e.tenant_id INTO v_exam_tenant
  FROM public.exams e
  WHERE e.id = p_exam_id;

  IF v_exam_tenant IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

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

    IF v_exam_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to exam from different tenant';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.subjects s WHERE s.id = p_subject_id AND s.tenant_id = v_exam_tenant
  ) THEN
    RAISE EXCEPTION 'Subject not found in your school';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_teacher_id AND p.tenant_id = v_exam_tenant
  ) THEN
    RAISE EXCEPTION 'Teacher not found in your school';
  END IF;

  INSERT INTO public.subject_teacher_access (tenant_id, exam_id, subject_id, teacher_id, granted_by)
  VALUES (
    v_exam_tenant, p_exam_id, p_subject_id, p_teacher_id,
    CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END
  )
  ON CONFLICT (exam_id, subject_id, teacher_id) DO NOTHING;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. revoke_subject_teacher_access
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_subject_teacher_access(
  p_exam_id uuid,
  p_subject_id uuid,
  p_teacher_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_exam_tenant UUID;
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
BEGIN
  SELECT e.tenant_id INTO v_exam_tenant
  FROM public.exams e
  WHERE e.id = p_exam_id;

  IF v_exam_tenant IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

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

    IF v_exam_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to exam from different tenant';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  DELETE FROM public.subject_teacher_access
  WHERE exam_id = p_exam_id
    AND subject_id = p_subject_id
    AND teacher_id = p_teacher_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Explicit REVOKE / GRANT (no PUBLIC / anon execute)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_subject_publish_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_subject(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_subject_teacher_access(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_subject_teacher_access(uuid, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_subject_publish_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publish_subject(uuid, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_subject_teacher_access(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_subject_teacher_access(uuid, uuid, uuid) TO authenticated, service_role;
