-- TUSOME analytics: Timetable Conflict Detection (Phase 3A)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Replace save_timetable_entry with conflict-aware version
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_timetable_entry(uuid, uuid, uuid, uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.save_timetable_entry(
  p_slot_id uuid,
  p_class_id uuid DEFAULT NULL,
  p_stream_id uuid DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL,
  p_teacher_id uuid DEFAULT NULL,
  p_room text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_entry_id UUID;
  v_slot RECORD;
  v_conflicts jsonb := '[]'::jsonb;
  v_conflict RECORD;
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

  -- Get the slot details
  SELECT * INTO v_slot
  FROM public.timetable_slots ts
  WHERE ts.id = p_slot_id
    AND (v_role = 'service_role' OR ts.tenant_id = v_caller_tenant);

  IF v_slot IS NULL THEN
    RAISE EXCEPTION 'Timetable slot not found';
  END IF;

  -- Check teacher conflict: same teacher, same day, overlapping time, different slot
  IF p_teacher_id IS NOT NULL THEN
    FOR v_conflict IN
      SELECT te.id AS entry_id, ts.day_of_week, ts.start_time, ts.end_time, c.name AS class_name
      FROM public.timetable_entries te
      JOIN public.timetable_slots ts ON ts.id = te.slot_id
      LEFT JOIN public.classes c ON c.id = te.class_id
      WHERE (v_role = 'service_role' OR te.tenant_id = v_caller_tenant)
        AND te.teacher_id = p_teacher_id
        AND ts.day_of_week = v_slot.day_of_week
        AND ts.id != p_slot_id
        AND (ts.start_time, ts.end_time) OVERLAPS (v_slot.start_time, v_slot.end_time)
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object(
        'type', 'teacher_conflict',
        'resource', 'teacher',
        'resource_id', p_teacher_id,
        'conflicting_entry_id', v_conflict.entry_id,
        'conflicting_class', v_conflict.class_name,
        'day', v_conflict.day_of_week,
        'time', v_conflict.start_time || ' - ' || v_conflict.end_time
      );
    END LOOP;
  END IF;

  -- Check class conflict: same class, same day, overlapping time, different slot
  IF p_class_id IS NOT NULL THEN
    FOR v_conflict IN
      SELECT te.id AS entry_id, ts.day_of_week, ts.start_time, ts.end_time, p.full_name AS teacher_name
      FROM public.timetable_entries te
      JOIN public.timetable_slots ts ON ts.id = te.slot_id
      LEFT JOIN public.profiles p ON p.id = te.teacher_id
      WHERE (v_role = 'service_role' OR te.tenant_id = v_caller_tenant)
        AND te.class_id = p_class_id
        AND (p_stream_id IS NULL OR te.stream_id = p_stream_id OR te.stream_id IS NULL)
        AND ts.day_of_week = v_slot.day_of_week
        AND ts.id != p_slot_id
        AND (ts.start_time, ts.end_time) OVERLAPS (v_slot.start_time, v_slot.end_time)
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object(
        'type', 'class_conflict',
        'resource', 'class',
        'resource_id', p_class_id,
        'conflicting_entry_id', v_conflict.entry_id,
        'conflicting_teacher', v_conflict.teacher_name,
        'day', v_conflict.day_of_week,
        'time', v_conflict.start_time || ' - ' || v_conflict.end_time
      );
    END LOOP;
  END IF;

  -- Check room conflict: same room, same day, overlapping time, different slot
  IF p_room IS NOT NULL AND btrim(p_room) != '' THEN
    FOR v_conflict IN
      SELECT te.id AS entry_id, ts.day_of_week, ts.start_time, ts.end_time, c.name AS class_name
      FROM public.timetable_entries te
      JOIN public.timetable_slots ts ON ts.id = te.slot_id
      LEFT JOIN public.classes c ON c.id = te.class_id
      WHERE (v_role = 'service_role' OR te.tenant_id = v_caller_tenant)
        AND te.room = btrim(p_room)
        AND ts.day_of_week = v_slot.day_of_week
        AND ts.id != p_slot_id
        AND (ts.start_time, ts.end_time) OVERLAPS (v_slot.start_time, v_slot.end_time)
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object(
        'type', 'room_conflict',
        'resource', 'room',
        'resource_id', p_room,
        'conflicting_entry_id', v_conflict.entry_id,
        'conflicting_class', v_conflict.class_name,
        'day', v_conflict.day_of_week,
        'time', v_conflict.start_time || ' - ' || v_conflict.end_time
      );
    END LOOP;
  END IF;

  -- If conflicts found, return them without saving
  IF jsonb_array_length(v_conflicts) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflicts', v_conflicts,
      'message', 'Timetable conflicts detected. Entry not saved.'
    );
  END IF;

  -- No conflicts: proceed with upsert
  DELETE FROM public.timetable_entries
  WHERE slot_id = p_slot_id
    AND (p_class_id IS NULL OR class_id = p_class_id)
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  INSERT INTO public.timetable_entries (tenant_id, slot_id, class_id, stream_id, subject_id, teacher_id, room, notes)
  VALUES (v_caller_tenant, p_slot_id, p_class_id, p_stream_id, p_subject_id, p_teacher_id, nullif(btrim(coalesce(p_room, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''))
  RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'conflicts', '[]'::jsonb,
    'message', 'Timetable entry saved successfully.'
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Explicit REVOKE / GRANT (updated return type)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.save_timetable_entry(uuid, uuid, uuid, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_timetable_entry(uuid, uuid, uuid, uuid, uuid, text, text) TO authenticated, service_role;
