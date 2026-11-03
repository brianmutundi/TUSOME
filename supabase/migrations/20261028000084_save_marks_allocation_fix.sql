-- Fix save_exam_subject_marks teacher allocation check (p_class_id is not a parameter).
CREATE OR REPLACE FUNCTION public.save_exam_subject_marks(p_exam_id uuid, p_subject_id uuid, p_entries jsonb)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_exam_tenant UUID;
  v_exam_status TEXT;
  v_subj_tenant UUID;
  v_caller_tenant UUID;
  v_role TEXT;
  v_can_enter BOOLEAN;
  v_item JSONB;
  v_student_id UUID;
  v_score NUMERIC;
  v_saved INT := 0;
BEGIN
  SELECT e.tenant_id, e.status INTO v_exam_tenant, v_exam_status
  FROM public.exams e
  WHERE e.id = p_exam_id;

  IF v_exam_tenant IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  SELECT sub.tenant_id INTO v_subj_tenant
  FROM public.subjects sub
  WHERE sub.id = p_subject_id;

  IF v_subj_tenant IS NULL THEN
    RAISE EXCEPTION 'Subject not found';
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

    IF v_exam_tenant <> v_caller_tenant OR v_subj_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to exam or subject from different tenant';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director', 'teacher'
        )
    ) INTO v_can_enter;

    IF NOT coalesce(v_can_enter, false) THEN
      RAISE EXCEPTION 'Access denied: teacher or administrator role required to enter marks';
    END IF;

    -- Teacher allocation check (deny by default for non-admin)
    IF v_role IS DISTINCT FROM 'service_role' AND NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-exams') THEN
      IF NOT EXISTS (SELECT 1 FROM public.exam_classes ec WHERE ec.exam_id = p_exam_id AND public.teacher_has_allocation(auth.uid(), ec.class_id, p_subject_id)) THEN
        RAISE EXCEPTION 'Access denied: not allocated to this class/subject';
      END IF;
    END IF;
  END IF;

  IF v_exam_status = 'published' THEN
    RAISE EXCEPTION 'Marks cannot be modified for a published exam';
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'Entries must be a JSON array';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    v_student_id := (v_item ->> 'student_id')::uuid;

    IF NOT EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = v_student_id AND s.tenant_id = v_exam_tenant
    ) THEN
      RAISE EXCEPTION 'Student not found in this school';
    END IF;

    IF v_item -> 'score' IS NULL
       OR jsonb_typeof(v_item -> 'score') = 'null'
       OR btrim(coalesce(v_item ->> 'score', '')) = '' THEN
      DELETE FROM public.marks
      WHERE exam_id = p_exam_id
        AND subject_id = p_subject_id
        AND student_id = v_student_id;
    ELSE
      v_score := (v_item ->> 'score')::numeric;
      IF v_score < 0 OR v_score > 100 THEN
        RAISE EXCEPTION 'Score must be between 0 and 100';
      END IF;

      INSERT INTO public.marks (tenant_id, exam_id, student_id, subject_id, score)
      VALUES (v_exam_tenant, p_exam_id, v_student_id, p_subject_id, ROUND(v_score, 2))
      ON CONFLICT (exam_id, student_id, subject_id) DO UPDATE SET
        score = EXCLUDED.score;

      v_saved := v_saved + 1;
    END IF;
  END LOOP;

  RETURN v_saved;
END;
$function$
;
