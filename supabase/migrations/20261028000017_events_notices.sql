-- TUSOME analytics: Zeraki-parity Events & Notices
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Events table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'general' CHECK (event_type IN ('general', 'academic', 'sports', 'cultural', 'meeting', 'holiday')),
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  location text,
  is_all_day boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_tenant ON public.events;
CREATE POLICY events_tenant ON public.events
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Notices table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  notice_type text NOT NULL DEFAULT 'general' CHECK (notice_type IN ('general', 'academic', 'urgent', 'reminder')),
  target_audience text NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'students', 'teachers', 'parents', 'staff')),
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notices_tenant ON public.notices;
CREATE POLICY notices_tenant ON public.notices
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notices TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_events
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_events(p_start_date timestamptz DEFAULT NULL, p_end_date timestamptz DEFAULT NULL)
RETURNS TABLE(
  event_id uuid,
  title text,
  description text,
  event_type text,
  start_date timestamptz,
  end_date timestamptz,
  location text,
  is_all_day boolean,
  created_by_name text,
  created_at timestamptz
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
    e.id AS event_id,
    e.title,
    e.description,
    e.event_type,
    e.start_date,
    e.end_date,
    e.location,
    e.is_all_day,
    p.full_name AS created_by_name,
    e.created_at
  FROM public.events e
  LEFT JOIN public.profiles p ON p.id = e.created_by
  WHERE (v_role = 'service_role' OR e.tenant_id = v_caller_tenant)
    AND (p_start_date IS NULL OR e.start_date >= p_start_date)
    AND (p_end_date IS NULL OR e.start_date <= p_end_date)
  ORDER BY e.start_date;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: create_event
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_event(
  p_title text,
  p_description text DEFAULT NULL,
  p_event_type text DEFAULT 'general',
  p_start_date timestamptz DEFAULT now(),
  p_end_date timestamptz DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_is_all_day boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_event_id UUID;
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

  IF btrim(coalesce(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Event title is required';
  END IF;

  INSERT INTO public.events (tenant_id, title, description, event_type, start_date, end_date, location, is_all_day, created_by)
  VALUES (v_caller_tenant, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), p_event_type, p_start_date, p_end_date, nullif(btrim(coalesce(p_location, '')), ''), p_is_all_day, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: get_notices
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_notices(p_target_audience text DEFAULT NULL)
RETURNS TABLE(
  notice_id uuid,
  title text,
  content text,
  notice_type text,
  target_audience text,
  is_published boolean,
  published_at timestamptz,
  expires_at timestamptz,
  created_by_name text,
  created_at timestamptz
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
    n.id AS notice_id,
    n.title,
    n.content,
    n.notice_type,
    n.target_audience,
    n.is_published,
    n.published_at,
    n.expires_at,
    p.full_name AS created_by_name,
    n.created_at
  FROM public.notices n
  LEFT JOIN public.profiles p ON p.id = n.created_by
  WHERE (v_role = 'service_role' OR n.tenant_id = v_caller_tenant)
    AND (p_target_audience IS NULL OR n.target_audience = p_target_audience OR n.target_audience = 'all')
  ORDER BY n.created_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: create_notice
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notice(
  p_title text,
  p_content text,
  p_notice_type text DEFAULT 'general',
  p_target_audience text DEFAULT 'all',
  p_is_published boolean DEFAULT false,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_notice_id UUID;
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

  IF btrim(coalesce(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Notice title is required';
  END IF;

  IF btrim(coalesce(p_content, '')) = '' THEN
    RAISE EXCEPTION 'Notice content is required';
  END IF;

  INSERT INTO public.notices (tenant_id, title, content, notice_type, target_audience, is_published, published_at, expires_at, created_by)
  VALUES (v_caller_tenant, btrim(p_title), btrim(p_content), p_notice_type, p_target_audience, p_is_published, CASE WHEN p_is_published THEN now() ELSE NULL END, p_expires_at, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_notice_id;

  RETURN v_notice_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_events(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_event(text, text, text, timestamptz, timestamptz, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_notices(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_notice(text, text, text, text, boolean, timestamptz) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_events(timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_event(text, text, text, timestamptz, timestamptz, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_notices(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_notice(text, text, text, text, boolean, timestamptz) TO authenticated, service_role;
