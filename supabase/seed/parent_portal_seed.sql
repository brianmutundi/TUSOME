-- Seed a test parent linked to a test student for repeatable parent-portal verification.
-- Replace :parent_auth_uid with a real auth.users id created via Supabase Auth
-- (email: parent.test@school.test, password: ParentTest123!).
-- Tenant: Gureta Nyasoko Comprehensive School

\set tenant_id '951758c7-2646-47b6-91c9-33b2699b7313'
\set student_id '4e79e60b-74dc-4d65-a9d8-868897852255'

insert into public.profiles (id, tenant_id, full_name, role, is_active)
values (:'parent_auth_uid'::uuid, :'tenant_id'::uuid, 'Test Parent', 'parent', true)
on conflict (id) do update set role='parent', is_active=true;

insert into public.parent_student_links (tenant_id, parent_id, student_id, relationship, is_primary)
values (:'tenant_id'::uuid, :'parent_auth_uid'::uuid, :'student_id'::uuid, 'parent', true)
on conflict (parent_id, student_id) do nothing;
