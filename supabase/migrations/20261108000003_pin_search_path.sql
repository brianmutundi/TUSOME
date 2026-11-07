-- Pin search_path on the four SECURITY DEFINER functions that lacked it.
-- (Prevents search_path injection; no behavior change.)

alter function public.prevent_audit_modification() set search_path = '';
alter function public.log_audit_event(text, text, uuid, jsonb, jsonb, text, uuid) set search_path = '';
alter function public.log_sensitive_field_access(text, uuid, text, text) set search_path = '';
alter function public.normalize_ke_phone(text) set search_path = '';
