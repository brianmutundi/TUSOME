-- Parent timetable (slice 2): a read-only weekly timetable for one child.
--
-- Why a new RPC: get_timetable (20261028000016) is SECURITY INVOKER and takes a
-- class id from the caller. Parents are blocked from direct table reads by the
-- parent_block policy, so they cannot use it, and it would also let a caller
-- pick any class. This function derives the class and stream from the child's
-- own student row after assert_parent_of, so the caller supplies only a child.
--
-- Schema facts checked against the migrations (no new tables here):
--   timetable_slots   (id, tenant_id, day_of_week 0-6, period_number, start_time,
--                      end_time, label)             -- 20261028000016
--                      day_of_week: 0 = Sunday (matches JS getDay() and the staff UI)
--   timetable_entries (id, tenant_id, slot_id, class_id, stream_id, subject_id,
--                      teacher_id, room, notes)     -- 20261028000016
--   students.class_id / students.stream_id, subjects.name, profiles.full_name,
--   all already used by get_timetable and get_my_children.
-- Both timetable tables already carry the parent_block policy, which the
-- 20261028000055 loop added to every table that had a policy at that time.
--
-- Rules:
--   * A lesson applies to the child when its class matches and its stream is
--     either null (whole class) or the child's own stream. If both a stream
--     lesson and a whole-class lesson exist for one slot, the stream lesson wins.
--   * Entries with no class are not returned (same as get_timetable with a class).
--   * Only slots that have a lesson for this class are returned. A break appears
--     only if the school recorded it as an entry.
--   * Internal columns (notes, teacher_id, entry class/stream ids) are not returned.
--   * No parent right is required: the timetable is class-level, not private to
--     the child. The parent-student link is still required.
-- Verified by supabase/tests/parent_timetable.sql on PostgreSQL 16 (slice 7).

create or replace function public.get_my_child_timetable(p_student_id uuid)
returns table(
  entry_id      uuid,
  day_of_week   integer,
  period_number integer,
  start_time    time,
  end_time      time,
  slot_label    text,
  subject_name  text,
  teacher_name  text,
  room          text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_class  uuid;
  v_stream uuid;
begin
  v_tenant := public.assert_parent_of(p_student_id);

  select s.class_id, s.stream_id
    into v_class, v_stream
  from public.students s
  where s.id = p_student_id
    and s.tenant_id = v_tenant;

  -- Not placed in a class yet: nothing to show.
  if v_class is null then
    return;
  end if;

  return query
  select
    pick.entry_id,
    pick.day_of_week,
    pick.period_number,
    pick.start_time,
    pick.end_time,
    pick.slot_label,
    pick.subject_name,
    pick.teacher_name,
    pick.room
  from (
    select distinct on (ts.id)
      te.id            as entry_id,
      ts.day_of_week   as day_of_week,
      ts.period_number as period_number,
      ts.start_time    as start_time,
      ts.end_time      as end_time,
      ts.label         as slot_label,
      sub.name         as subject_name,
      tp.full_name     as teacher_name,
      te.room          as room
    from public.timetable_slots ts
    join public.timetable_entries te
      on te.slot_id = ts.id
     and te.tenant_id = v_tenant
    left join public.subjects sub
      on sub.id = te.subject_id
     and sub.tenant_id = v_tenant
    left join public.profiles tp
      on tp.id = te.teacher_id
     and tp.tenant_id = v_tenant
    where ts.tenant_id = v_tenant
      and te.class_id = v_class
      and (te.stream_id is null or te.stream_id = v_stream)
    -- stream-specific lesson first, then whole-class
    order by ts.id, (te.stream_id is null), te.created_at, te.id
  ) pick
  order by pick.day_of_week, pick.period_number;
end;
$function$;

revoke all on function public.get_my_child_timetable(uuid) from public, anon;
grant execute on function public.get_my_child_timetable(uuid) to authenticated, service_role;
