-- Demo fixture: link the demo parent account to the demo student so the parent
-- portal has data to show. Idempotent; safe to re-run.
--
-- Parent portal was empty because parent_student_links had zero rows.

insert into public.parent_student_links (tenant_id, parent_id, student_id, relationship, is_primary)
select s.tenant_id, p.id, s.id, 'parent', true
from public.students s
join public.profiles p on p.email = 'parent@demo.school'
where s.id = '9b829c7b-4558-4a47-95c6-cd7e59f1494c'
  and p.tenant_id = s.tenant_id
  and not exists (
    select 1 from public.parent_student_links x
    where x.parent_id = p.id and x.student_id = s.id
  );

update public.profiles
set phone = coalesce(nullif(phone, ''), '+254700000001')
where email = 'parent@demo.school';
