-- TUSOME analytics: Zeraki-parity Timetable
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Zeraki bundle evidence
-- ----------------------
-- 1. Timetable routes (route_tree.tsv):
--      * /main/timetable               (dashboard)
--      * /main/timetable/class         (class timetable)
--      * /main/timetable/teacher       (teacher timetable)
--      * /main-legacy/timetable/*      (legacy variants)

-- ---------------------------------------------------------------------------
-- 1. Timetable slots table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period_number integer NOT NULL CHECK (period_number > 0),
  start_time time NOT NULL,
  end_time time NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, day_of_week, period_number)
);

ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS timetable_slots_tenant ON public.timetable_slots;
CREATE POLICY timetable_slots_tenant ON public.timetable_slots
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_slots TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Timetable entries table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.timetable_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES public.timetable_slots (id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL,
  stream_id uuid REFERENCES public.streams (id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects (id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  room text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS timetable_entries_tenant ON public.timetable_entries;
CREATE POLICY timetable_entries_tenant ON public.timetable_entries
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_entries TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_timetable
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_timetable(p_class_id uuid DEFAULT NULL, p_teacher_id uuid DEFAULT NULL)
RETURNS TABLE(
  entry_id uuid,
  slot_id uuid,
  day_of_week integer,
  period_number integer,
  start_time time,
  end_time time,
  slot_label text,
  class_id uuid,
  class_name text,
  stream_id uuid,
  stream_name text,
  subject_id uuid,
  subject_name text,
  teacher_id uuid,
  teacher_name text,
  room text,
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
    te.id AS entry_id,
    ts.id AS slot_id,
    ts.day_of_week,
    ts.period_number,
    ts.start_time,
    ts.end_time,
    ts.label AS slot_label,
    te.class_id,
    c.name AS class_name,
    te.stream_id,
    st.name AS stream_name,
    te.subject_id,
    sub.name AS subject_name,
    te.teacher_id,
    p.full_name AS teacher_name,
    te.room,
    te.notes
  FROM public.timetable_slots ts
  LEFT JOIN public.timetable_entries te ON te.slot_id = ts.id
  LEFT JOIN public.classes c ON c.id = te.class_id
  LEFT JOIN public.streams st ON st.id = te.stream_id
  LEFT JOIN public.subjects sub ON sub.id = te.subject_id
  LEFT JOIN public.profiles p ON p.id = te.teacher_id
  WHERE (v_role = 'service_role' OR ts.tenant_id = v_caller_tenant)
    AND (p_class_id IS NULL OR te.class_id = p_class_id)
    AND (p_teacher_id IS NULL OR te.teacher_id = p_teacher_id)
  ORDER BY ts.day_of_week, ts.period_number;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: save_timetable_entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_timetable_entry(
  p_slot_id uuid,
  p_class_id uuid DEFAULT NULL,
  p_stream_id uuid DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL,
  p_teacher_id uuid DEFAULT NULL,
  p_room text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_entry_id UUID;
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

  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-timetable') THEN
      RAISE EXCEPTION 'Access denied: manage-timetable permission required';
    END IF;
  END IF;

  -- Upsert: delete existing entry for this slot+class, then insert
  DELETE FROM public.timetable_entries
  WHERE slot_id = p_slot_id AND (p_class_id IS NULL OR class_id = p_class_id);

  INSERT INTO public.timetable_entries (tenant_id, slot_id, class_id, stream_id, subject_id, teacher_id, room, notes)
  VALUES (v_caller_tenant, p_slot_id, p_class_id, p_stream_id, p_subject_id, p_teacher_id, nullif(btrim(coalesce(p_room, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''))
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: upsert_timetable_slot
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_timetable_slot(
  p_day_of_week integer,
  p_period_number integer,
  p_start_time time,
  p_end_time time,
  p_label text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_slot_id UUID;
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

  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-timetable') THEN
      RAISE EXCEPTION 'Access denied: manage-timetable permission required';
    END IF;
  END IF;

  INSERT INTO public.timetable_slots (tenant_id, day_of_week, period_number, start_time, end_time, label)
  VALUES (v_caller_tenant, p_day_of_week, p_period_number, p_start_time, p_end_time, nullif(btrim(coalesce(p_label, '')), ''))
  ON CONFLICT (tenant_id, day_of_week, period_number) DO UPDATE SET
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    label = EXCLUDED.label
  RETURNING id INTO v_slot_id;

  RETURN v_slot_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_timetable(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_timetable_entry(uuid, uuid, uuid, uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_timetable_slot(integer, integer, time, time, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_timetable(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_timetable_entry(uuid, uuid, uuid, uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_timetable_slot(integer, integer, time, time, text) TO authenticated, service_role;
