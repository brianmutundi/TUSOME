-- TUSOME analytics: Library Management (Phase 5)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Library books table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  title text NOT NULL,
  author text,
  isbn text,
  category text,
  publisher text,
  publication_year integer,
  total_copies integer NOT NULL DEFAULT 1,
  available_copies integer NOT NULL DEFAULT 1,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS library_books_tenant ON public.library_books;
CREATE POLICY library_books_tenant ON public.library_books
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_books TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Book loans table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.book_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.library_books (id) ON DELETE CASCADE,
  borrower_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  borrower_type text NOT NULL DEFAULT 'student' CHECK (borrower_type IN ('student', 'teacher', 'staff')),
  loan_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  return_date date,
  status text NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue', 'lost')),
  fine_amount numeric DEFAULT 0,
  fine_paid boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.book_loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS book_loans_tenant ON public.book_loans;
CREATE POLICY book_loans_tenant ON public.book_loans
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.book_loans TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_library_books
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_library_books(p_search text DEFAULT NULL)
RETURNS TABLE(
  book_id uuid,
  title text,
  author text,
  isbn text,
  category text,
  publisher text,
  publication_year integer,
  total_copies integer,
  available_copies integer,
  location text,
  is_active boolean
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
    lb.id AS book_id,
    lb.title,
    lb.author,
    lb.isbn,
    lb.category,
    lb.publisher,
    lb.publication_year,
    lb.total_copies,
    lb.available_copies,
    lb.location,
    lb.is_active
  FROM public.library_books lb
  WHERE (v_role = 'service_role' OR lb.tenant_id = v_caller_tenant)
    AND (p_search IS NULL OR lb.title ILIKE '%' || p_search || '%' OR lb.author ILIKE '%' || p_search || '%' OR lb.isbn ILIKE '%' || p_search || '%')
  ORDER BY lb.title;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: add_library_book
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_library_book(
  p_title text,
  p_author text DEFAULT NULL,
  p_isbn text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_publisher text DEFAULT NULL,
  p_publication_year integer DEFAULT NULL,
  p_total_copies integer DEFAULT 1,
  p_location text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_book_id UUID;
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
    RAISE EXCEPTION 'Book title is required';
  END IF;

  INSERT INTO public.library_books (tenant_id, title, author, isbn, category, publisher, publication_year, total_copies, available_copies, location)
  VALUES (v_caller_tenant, btrim(p_title), nullif(btrim(coalesce(p_author, '')), ''), nullif(btrim(coalesce(p_isbn, '')), ''), nullif(btrim(coalesce(p_category, '')), ''), nullif(btrim(coalesce(p_publisher, '')), ''), p_publication_year, p_total_copies, p_total_copies, nullif(btrim(coalesce(p_location, '')), ''))
  RETURNING id INTO v_book_id;

  RETURN v_book_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: borrow_book
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.borrow_book(
  p_book_id uuid,
  p_borrower_id uuid,
  p_borrower_type text DEFAULT 'student',
  p_due_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_book RECORD;
  v_loan_id UUID;
  v_due DATE;
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

  -- Check book availability
  SELECT * INTO v_book
  FROM public.library_books
  WHERE id = p_book_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_book IS NULL THEN
    RAISE EXCEPTION 'Book not found';
  END IF;

  IF v_book.available_copies <= 0 THEN
    RAISE EXCEPTION 'No copies available for borrowing';
  END IF;

  v_due := COALESCE(p_due_date, CURRENT_DATE + INTERVAL '14 days');

  -- Create loan
  INSERT INTO public.book_loans (tenant_id, book_id, borrower_id, borrower_type, due_date)
  VALUES (v_caller_tenant, p_book_id, p_borrower_id, p_borrower_type, v_due)
  RETURNING id INTO v_loan_id;

  -- Decrement available copies
  UPDATE public.library_books SET available_copies = available_copies - 1, updated_at = now()
  WHERE id = p_book_id;

  RETURN v_loan_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: return_book
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_book(
  p_loan_id uuid,
  p_fine_amount numeric DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_loan RECORD;
  v_updated INT;
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

  SELECT * INTO v_loan
  FROM public.book_loans
  WHERE id = p_loan_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_loan IS NULL THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;

  IF v_loan.status = 'returned' THEN
    RAISE EXCEPTION 'Book already returned';
  END IF;

  -- Update loan
  UPDATE public.book_loans SET
    return_date = CURRENT_DATE,
    status = 'returned',
    fine_amount = p_fine_amount,
    updated_at = now()
  WHERE id = p_loan_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Increment available copies
  UPDATE public.library_books SET available_copies = available_copies + 1, updated_at = now()
  WHERE id = v_loan.book_id;

  RETURN v_updated > 0;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: get_book_loans
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_book_loans(p_status text DEFAULT NULL, p_borrower_id uuid DEFAULT NULL)
RETURNS TABLE(
  loan_id uuid,
  book_id uuid,
  book_title text,
  borrower_id uuid,
  borrower_name text,
  borrower_type text,
  loan_date date,
  due_date date,
  return_date date,
  status text,
  fine_amount numeric,
  fine_paid boolean,
  is_overdue boolean
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
    bl.id AS loan_id,
    bl.book_id,
    lb.title AS book_title,
    bl.borrower_id,
    p.full_name AS borrower_name,
    bl.borrower_type,
    bl.loan_date,
    bl.due_date,
    bl.return_date,
    CASE
      WHEN bl.status = 'returned' THEN 'returned'
      WHEN bl.due_date < CURRENT_DATE AND bl.return_date IS NULL THEN 'overdue'
      ELSE bl.status
    END AS status,
    bl.fine_amount,
    bl.fine_paid,
    (bl.due_date < CURRENT_DATE AND bl.return_date IS NULL) AS is_overdue
  FROM public.book_loans bl
  LEFT JOIN public.library_books lb ON lb.id = bl.book_id
  LEFT JOIN public.profiles p ON p.id = bl.borrower_id
  WHERE (v_role = 'service_role' OR bl.tenant_id = v_caller_tenant)
    AND (p_status IS NULL OR bl.status = p_status)
    AND (p_borrower_id IS NULL OR bl.borrower_id = p_borrower_id)
  ORDER BY bl.loan_date DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_library_books(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_library_book(text, text, text, text, text, integer, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.borrow_book(uuid, uuid, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.return_book(uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_book_loans(text, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_library_books(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_library_book(text, text, text, text, text, integer, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.borrow_book(uuid, uuid, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.return_book(uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_book_loans(text, uuid) TO authenticated, service_role;
