# Phase 10 — Files and exports audit

## Storage
- No storage buckets defined in migrations or src. No `supabase.storage` usage found. Storage policies are dashboard-only and unaudited (Phase 12 item).

## Export / print / download endpoints
- 7 PDF route handlers under src/app/api. Token-based routes (receipt/[token], statement/[token]) authorize via the share token. Caller-JWT routes (finance/statement, pdf, receipts/[id], trips/...) authenticate but do not check a specific export/print permission (e.g. access-printouts, view-fees).
- CSV/Excel exports are generated client-side (src/lib/analytics/csv.ts, excel.ts) and triggered from pages; permission gating on the trigger buttons is part of the Phase 6 sweep.
- Recommendation (Phase 7 follow-up): add permission checks (access-printouts / view-fees / view-transcripts) to caller-JWT PDF routes, returning 403 when missing.

## Import endpoints
- Marks import and students import are client-side parsing + RPC calls; RPCs enforce tenant. No dedicated import permission code exists in the catalogue — gap to document (PD candidate).
