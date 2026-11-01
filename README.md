# TUSOME

TUSOME is a Kenyan school-management platform. This repository includes the Next.js application, Supabase migrations, SQL regression tests, and operational documentation.

## Quick start

Requirements: Node.js 20 (Node.js 18.18+ is supported by the package) and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set these public browser configuration values in `.env.local` before using authenticated features:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Use only the Supabase publishable/anon key in browser-exposed variables. Never put a service-role key in a `NEXT_PUBLIC_*` variable or commit secrets.

## Verification

Run the application checks before opening a pull request:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

SQL regression checks are documented in `supabase/tests/`. Run database tests only against a disposable local PostgreSQL database or an explicitly approved staging database; never point fixture/rollback tests at production.

## Database safety and analytics fixes

Important analytics migrations and evidence:

- [Analytics baseline](supabase/migrations/20261028000000_create_analytics_functions.sql) — historical baseline; do not blindly replay against a database where these functions already exist.
- [Correctness fix](supabase/migrations/20261028000001_fix_roster_joins_and_config_grading.sql) — fixes duplicated marks caused by roster joins and uses tenant grading configuration for broad grade counts.
- [Anonymous EXECUTE hardening proposal](supabase/migrations/20261028000002_revoke_anon_execute_analytics.sql) — removes inherited `PUBLIC`/anonymous execution from analytics RPCs.
- [Student report header fix](supabase/migrations/20261028000003_fix_student_report_header.sql) — uses the authoritative enrollment for class/stream/year details.
- [Staging validation report](supabase/tests/STAGING_VALIDATION_REPORT.md) — required preflight, verification, rollback and outstanding blockers.
- [Product-owner decisions](supabase/tests/PRODUCT_DECISIONS.md) — pass-mark policy and database authorization decisions that require sign-off.

**Production is not changed by repository commits or CI.** Before applying database changes, inspect the real schema, function definitions, ACLs and migration history in authorized staging. Follow the staging report's ordered deployment and rollback steps. Do not run `supabase db push` against the affected project: the historical baseline can drop/recreate functions and restore the default `PUBLIC EXECUTE` grant.

The pass-rate threshold currently remains `score >= 40`; do not change it without an explicit product decision because the schema does not currently define a configurable pass mark.

## Project references

- [Analytics feature guide](README_ANALYTICS.md)
- [Product scope](PRODUCT.md)
- [Design system](DESIGN.md)
- [ODPC / data-protection notes](docs/ODPC_COMPLIANCE.md)
