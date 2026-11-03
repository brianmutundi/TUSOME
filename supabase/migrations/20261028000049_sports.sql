-- TUSOME analytics: Sports & Competitions Tracking (Phase 5)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Sports/activities table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sport_type text NOT NULL DEFAULT 'sport' CHECK (sport_type IN ('sport', 'club', 'activity', 'competition')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sports_tenant ON public.sports;
CREATE POLICY sports_tenant ON public.sports
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Sports events/competitions table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sports_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  sport_id uuid REFERENCES public.sports (id) ON DELETE SET NULL,
  title text NOT NULL,
  event_date date NOT NULL,
  event_type text NOT NULL DEFAULT 'match' CHECK (event_type IN ('match', 'tournament', 'training', 'competition', 'friendly')),
  venue text,
  opponent text,
  result text,
  score text,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sports_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sports_events_tenant ON public.sports_events;
CREATE POLICY sports_events_tenant ON public.sports_events
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_events TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Sports participation table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sports_participation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.sports_events (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  role text DEFAULT 'player' CHECK (role IN ('player', 'captain', 'reserve', 'official', 'support')),
  performance_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, student_id)
);

ALTER TABLE public.sports_participation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sports_participation_tenant ON public.sports_participation;
CREATE POLICY sports_participation_tenant ON public.sports_participation
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_participation TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. RPC: get_sports
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sports()
RETURNS TABLE(
  sport_id uuid,
  name text,
  description text,
  sport_type text,
  is_active boolean,
  event_count bigint
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
    s.id AS sport_id,
    s.name,
    s.description,
    s.sport_type,
    s.is_active,
    (SELECT COUNT(*) FROM public.sports_events se WHERE se.sport_id = s.id) AS event_count
  FROM public.sports s
  WHERE (v_role = 'service_role' OR s.tenant_id = v_caller_tenant)
  ORDER BY s.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: create_sport
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_sport(
  p_name text,
  p_description text DEFAULT NULL,
  p_sport_type text DEFAULT 'sport'
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_sport_id UUID;
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

  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Sport name is required';
  END IF;

  INSERT INTO public.sports (tenant_id, name, description, sport_type)
  VALUES (v_caller_tenant, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_sport_type)
  RETURNING id INTO v_sport_id;

  RETURN v_sport_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_sports_events
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sports_events(p_sport_id uuid DEFAULT NULL)
RETURNS TABLE(
  event_id uuid,
  sport_id uuid,
  sport_name text,
  title text,
  event_date date,
  event_type text,
  venue text,
  opponent text,
  result text,
  score text,
  participant_count bigint
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
    se.id AS event_id,
    se.sport_id,
    s.name AS sport_name,
    se.title,
    se.event_date,
    se.event_type,
    se.venue,
    se.opponent,
    se.result,
    se.score,
    (SELECT COUNT(*) FROM public.sports_participation sp WHERE sp.event_id = se.id) AS participant_count
  FROM public.sports_events se
  LEFT JOIN public.sports s ON s.id = se.sport_id
  WHERE (v_role = 'service_role' OR se.tenant_id = v_caller_tenant)
    AND (p_sport_id IS NULL OR se.sport_id = p_sport_id)
  ORDER BY se.event_date DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: create_sports_event
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_sports_event(
  p_title text,
  p_event_date date,
  p_sport_id uuid DEFAULT NULL,
  p_event_type text DEFAULT 'match',
  p_venue text DEFAULT NULL,
  p_opponent text DEFAULT NULL,
  p_result text DEFAULT NULL,
  p_score text DEFAULT NULL,
  p_notes text DEFAULT NULL
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

  INSERT INTO public.sports_events (tenant_id, sport_id, title, event_date, event_type, venue, opponent, result, score, notes, created_by)
  VALUES (v_caller_tenant, p_sport_id, btrim(p_title), p_event_date, p_event_type, nullif(btrim(coalesce(p_venue, '')), ''), nullif(btrim(coalesce(p_opponent, '')), ''), nullif(btrim(coalesce(p_result, '')), ''), nullif(btrim(coalesce(p_score, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''), CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. RPC: add_sports_participation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_sports_participation(
  p_event_id uuid,
  p_student_id uuid,
  p_role text DEFAULT 'player',
  p_performance_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_part_id UUID;
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

  INSERT INTO public.sports_participation (tenant_id, event_id, student_id, role, performance_notes)
  VALUES (v_caller_tenant, p_event_id, p_student_id, p_role, nullif(btrim(coalesce(p_performance_notes, '')), ''))
  ON CONFLICT (event_id, student_id) DO UPDATE SET
    role = EXCLUDED.role,
    performance_notes = EXCLUDED.performance_notes
  RETURNING id INTO v_part_id;

  RETURN v_part_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. RPC: get_sports_participation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sports_participation(p_event_id uuid)
RETURNS TABLE(
  participation_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  role text,
  performance_notes text
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
    sp.id AS participation_id,
    sp.student_id,
    s.full_name AS student_name,
    s.admission_no,
    sp.role,
    sp.performance_notes
  FROM public.sports_participation sp
  LEFT JOIN public.students s ON s.id = sp.student_id
  WHERE (v_role = 'service_role' OR sp.tenant_id = v_caller_tenant)
    AND sp.event_id = p_event_id
  ORDER BY s.full_name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_sports() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_sport(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_sports_events(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_sports_event(text, date, uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_sports_participation(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_sports_participation(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_sports() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_sport(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_sports_events(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_sports_event(text, date, uuid, text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_sports_participation(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_sports_participation(uuid) TO authenticated, service_role;
