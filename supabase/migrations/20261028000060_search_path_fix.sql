-- Set search_path on SECURITY DEFINER functions that lacked it
alter function public.log_audit_event set search_path = public;
alter function public.log_sensitive_field_access set search_path = public;
alter function public.upsert_teacher_profile set search_path = public;
