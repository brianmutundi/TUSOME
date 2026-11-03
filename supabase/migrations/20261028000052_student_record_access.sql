-- 20261028000052_student_record_access.sql
--
-- 1. Register permission codes that SQL already checks but the catalogue never
--    listed. user_permissions / role_permissions have a foreign key to
--    permissions(code), so those codes could not be granted to anyone; only the
--    admin-type roles that bypass the check could pass them.
--    Registering a code grants it to nobody. Roles and users opt in as usual.
-- 2. Add assert_student_access(): tenant + permission guard for student records.
-- 3. Add the two reads the student profile needs: get_student_notes and
--    get_student_memberships (groups and residence).
-- 4. Re-define the student record RPCs so they enforce permission and tenant
--    ownership of the student. Signatures are unchanged, so this is a true replace.
--
-- Not run against a database here. Run `npm run db:test` before applying.

-- ---------------------------------------------------------------------------
-- 1. Permission catalogue
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (code, category_code, category_name, display_name, sort_order) VALUES
  ('edit-student-groups',        'students',   'Students',            'Create student groups and assign students', 58),
  ('add-edit-student-residences','students',   'Students',            'Manage residences and assign students',     59),
  ('add-target-grades',          'exams',      'Exams & Grading',     'Add target grades',                         100),
  ('compose-send-sms',           'messaging',  'Messaging',           'Compose and send SMS',                      110),
  ('manage-fees',                'finance',    'Finance',             'Manage fee structures and collections',     120),
  ('approve-fee-waiver',         'finance',    'Finance',             'Approve fee waivers',                       121),
  ('manage-timetable',           'timetable',  'Timetable',           'Manage the timetable',                      130),
  ('close-fiscal-period',        'accounting', 'Accounting',          'Close fiscal periods',                      140),
  ('reopen-fiscal-period',       'accounting', 'Accounting',          'Reopen fiscal periods',                     141),
  ('approve-budget',             'accounting', 'Accounting',          'Approve budgets',                           142),
  ('approve-leave',              'staff',      'Teachers & Staff',    'Approve leave requests',                    150),
  ('manage-payroll',             'payroll',    'Payroll',             'Manage payroll',                            160),
  ('approve-payroll',            'payroll',    'Payroll',             'Approve payroll',                           161),
  ('finalize-payroll',           'payroll',    'Payroll',             'Finalize payroll',                          162),
  ('manage-retention',           'settings',   'Settings & User Roles','Manage data retention',                    170)
ON CONFLICT (code) DO UPDATE SET
  category_code = EXCLUDED.category_code,
  category_name = EXCLUDED.category_name,
  display_name  = EXCLUDED.display_name,
  sort_order    = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- 2. assert_student_access
--    Returns the student's tenant. Raises when the student does not exist, the
--    caller has no tenant claim, the student belongs to another tenant, or the
--    caller lacks the permission. service_role skips the caller checks.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_student_access(
  p_student_id uuid,
  p_permission text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_role TEXT;
  v_caller_tenant UUID;
  v_student_tenant UUID;
BEGIN
  SELECT s.tenant_id INTO v_student_tenant
  FROM public.students s
  WHERE s.id = p_student_id;

  IF v_student_tenant IS NULL THEN
    RAISE EXCEPTION 'Student not found';
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

    IF v_student_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to student from different tenant';
    END IF;

    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, p_permission) THEN
      RAISE EXCEPTION 'Access denied: % permission required', p_permission;
    END IF;
  END IF;

  RETURN v_student_tenant;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Reads: get_student_notes, get_student_memberships
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_notes(p_student_id uuid)
RETURNS TABLE(
  id uuid,
  student_id uuid,
  note_type text,
  title text,
  content text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_tenant UUID;
BEGIN
  v_tenant := public.assert_student_access(p_student_id, 'view-student-profile');

  RETURN QUERY
  SELECT
    sn.id,
    sn.student_id,
    sn.note_type,
    sn.title,
    sn.content,
    sn.created_by,
    p.full_name AS created_by_name,
    sn.created_at
  FROM public.student_notes sn
  LEFT JOIN public.profiles p ON p.id = sn.created_by
  WHERE sn.student_id = p_student_id
    AND sn.tenant_id = v_tenant
  ORDER BY sn.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_memberships(p_student_id uuid)
RETURNS TABLE(
  kind text,
  ref_id uuid,
  name text,
  detail text
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_tenant UUID;
BEGIN
  v_tenant := public.assert_student_access(p_student_id, 'view-student-profile');

  RETURN QUERY
  SELECT 'group'::text, sg.id, sg.name, sg.description
  FROM public.student_group_members sgm
  JOIN public.student_groups sg ON sg.id = sgm.group_id
  WHERE sgm.student_id = p_student_id
    AND sg.tenant_id = v_tenant
  UNION ALL
  SELECT 'residence'::text, sr.id, sr.name, sr.type
  FROM public.student_residence_assignments sra
  JOIN public.student_residences sr ON sr.id = sra.residence_id
  WHERE sra.student_id = p_student_id
    AND sra.tenant_id = v_tenant
    AND sr.tenant_id = v_tenant;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Student record writes, now permission-checked
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_student_note(
  p_student_id uuid,
  p_note_type text,
  p_title text,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_role TEXT;
  v_student_tenant UUID;
  v_note_id UUID;
BEGIN
  v_student_tenant := public.assert_student_access(p_student_id, 'edit-student-profile');

  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF p_note_type NOT IN ('general', 'academic', 'behavioural', 'medical', 'disciplinary') THEN
    RAISE EXCEPTION 'Invalid note type';
  END IF;

  IF btrim(coalesce(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Note title is required';
  END IF;

  INSERT INTO public.student_notes (tenant_id, student_id, note_type, title, content, created_by)
  VALUES (
    v_student_tenant, p_student_id, p_note_type, btrim(p_title), coalesce(p_content, ''),
    CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END
  )
  RETURNING id INTO v_note_id;

  RETURN v_note_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_student_note(p_note_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_student_id UUID;
BEGIN
  SELECT sn.student_id INTO v_student_id
  FROM public.student_notes sn
  WHERE sn.id = p_note_id;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Note not found';
  END IF;

  PERFORM public.assert_student_access(v_student_id, 'edit-student-profile');

  DELETE FROM public.student_notes WHERE id = p_note_id;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_student_to_group(
  p_student_id uuid,
  p_group_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_student_tenant UUID;
  v_group_tenant UUID;
BEGIN
  v_student_tenant := public.assert_student_access(p_student_id, 'edit-student-groups');

  SELECT sg.tenant_id INTO v_group_tenant
  FROM public.student_groups sg
  WHERE sg.id = p_group_id;

  IF v_group_tenant IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF v_group_tenant <> v_student_tenant THEN
    RAISE EXCEPTION 'Access denied: cross-tenant assignment';
  END IF;

  INSERT INTO public.student_group_members (group_id, student_id)
  VALUES (p_group_id, p_student_id)
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_student_residence(
  p_student_id uuid,
  p_residence_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_student_tenant UUID;
  v_residence_tenant UUID;
BEGIN
  v_student_tenant := public.assert_student_access(p_student_id, 'add-edit-student-residences');

  SELECT sr.tenant_id INTO v_residence_tenant
  FROM public.student_residences sr
  WHERE sr.id = p_residence_id;

  IF v_residence_tenant IS NULL THEN
    RAISE EXCEPTION 'Residence not found';
  END IF;

  IF v_residence_tenant <> v_student_tenant THEN
    RAISE EXCEPTION 'Access denied: cross-tenant assignment';
  END IF;

  INSERT INTO public.student_residence_assignments (tenant_id, student_id, residence_id)
  VALUES (v_student_tenant, p_student_id, p_residence_id)
  ON CONFLICT (student_id) DO UPDATE SET
    residence_id = EXCLUDED.residence_id,
    assigned_at = now();

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_emergency_contacts(p_student_id uuid)
RETURNS TABLE(
  contact_id uuid,
  student_id uuid,
  full_name text,
  relationship text,
  phone_primary text,
  phone_secondary text,
  email text,
  is_primary boolean,
  is_authorized_pickup boolean,
  notes text
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_tenant UUID;
BEGIN
  v_tenant := public.assert_student_access(p_student_id, 'view-student-profile');

  RETURN QUERY
  SELECT
    ec.id AS contact_id,
    ec.student_id,
    ec.full_name,
    ec.relationship,
    ec.phone_primary,
    ec.phone_secondary,
    ec.email,
    ec.is_primary,
    ec.is_authorized_pickup,
    ec.notes
  FROM public.emergency_contacts ec
  WHERE ec.tenant_id = v_tenant
    AND ec.student_id = p_student_id
  ORDER BY ec.is_primary DESC, ec.full_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_emergency_contact(
  p_student_id uuid,
  p_full_name text,
  p_relationship text,
  p_phone_primary text,
  p_phone_secondary text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_is_primary boolean DEFAULT false,
  p_is_authorized_pickup boolean DEFAULT false,
  p_notes text DEFAULT NULL,
  p_contact_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_tenant UUID;
  v_contact_id UUID;
BEGIN
  v_tenant := public.assert_student_access(p_student_id, 'edit-student-profile');

  IF btrim(coalesce(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'Contact name is required';
  END IF;

  IF btrim(coalesce(p_phone_primary, '')) = '' THEN
    RAISE EXCEPTION 'Primary phone is required';
  END IF;

  IF p_contact_id IS NOT NULL THEN
    UPDATE public.emergency_contacts SET
      full_name = btrim(p_full_name),
      relationship = btrim(p_relationship),
      phone_primary = btrim(p_phone_primary),
      phone_secondary = nullif(btrim(coalesce(p_phone_secondary, '')), ''),
      email = nullif(btrim(coalesce(p_email, '')), ''),
      is_primary = p_is_primary,
      is_authorized_pickup = p_is_authorized_pickup,
      notes = nullif(btrim(coalesce(p_notes, '')), '')
    WHERE id = p_contact_id
      AND tenant_id = v_tenant
      AND student_id = p_student_id
    RETURNING id INTO v_contact_id;

    IF v_contact_id IS NULL THEN
      RAISE EXCEPTION 'Emergency contact not found for this student';
    END IF;
  ELSE
    INSERT INTO public.emergency_contacts (tenant_id, student_id, full_name, relationship, phone_primary, phone_secondary, email, is_primary, is_authorized_pickup, notes)
    VALUES (v_tenant, p_student_id, btrim(p_full_name), btrim(p_relationship), btrim(p_phone_primary), nullif(btrim(coalesce(p_phone_secondary, '')), ''), nullif(btrim(coalesce(p_email, '')), ''), p_is_primary, p_is_authorized_pickup, nullif(btrim(coalesce(p_notes, '')), ''))
    RETURNING id INTO v_contact_id;
  END IF;

  RETURN v_contact_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_medical_alerts(p_student_id uuid)
RETURNS TABLE(
  alert_id uuid,
  student_id uuid,
  alert_type text,
  description text,
  severity text,
  instructions text,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_tenant UUID;
BEGIN
  v_tenant := public.assert_student_access(p_student_id, 'view-student-profile');

  RETURN QUERY
  SELECT
    ma.id AS alert_id,
    ma.student_id,
    ma.alert_type,
    ma.description,
    ma.severity,
    ma.instructions,
    ma.is_active,
    ma.created_at
  FROM public.medical_alerts ma
  WHERE ma.tenant_id = v_tenant
    AND ma.student_id = p_student_id
  ORDER BY
    CASE ma.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
    ma.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_medical_alert(
  p_student_id uuid,
  p_alert_type text,
  p_description text,
  p_severity text DEFAULT 'medium',
  p_instructions text DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_alert_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_role TEXT;
  v_tenant UUID;
  v_alert_id UUID;
BEGIN
  v_tenant := public.assert_student_access(p_student_id, 'edit-student-profile');

  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF btrim(coalesce(p_description, '')) = '' THEN
    RAISE EXCEPTION 'Alert description is required';
  END IF;

  IF p_alert_id IS NOT NULL THEN
    UPDATE public.medical_alerts SET
      alert_type = p_alert_type,
      description = btrim(p_description),
      severity = p_severity,
      instructions = nullif(btrim(coalesce(p_instructions, '')), ''),
      is_active = p_is_active,
      updated_at = now()
    WHERE id = p_alert_id
      AND tenant_id = v_tenant
      AND student_id = p_student_id
    RETURNING id INTO v_alert_id;

    IF v_alert_id IS NULL THEN
      RAISE EXCEPTION 'Medical alert not found for this student';
    END IF;
  ELSE
    INSERT INTO public.medical_alerts (tenant_id, student_id, alert_type, description, severity, instructions, is_active, created_by)
    VALUES (v_tenant, p_student_id, p_alert_type, btrim(p_description), p_severity, nullif(btrim(coalesce(p_instructions, '')), ''), p_is_active, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
    RETURNING id INTO v_alert_id;
  END IF;

  RETURN v_alert_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Grants (re-stated; CREATE OR REPLACE keeps existing grants but the new
-- functions need them)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.assert_student_access(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_student_notes(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_student_memberships(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.assert_student_access(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_notes(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_memberships(uuid) TO authenticated, service_role;
