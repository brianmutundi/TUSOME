# TUSOME

## Database tests

There is no local disposable harness in this repo. Database tests run against a dedicated (non-production) Supabase project via the Supabase CLI:

```bash
supabase link --project-ref <staging-ref>
supabase db push
```

Never run against production. The `db:check-rpcs` script verifies that every RPC called in `src/` is defined in `supabase/migrations/`:

```bash
npm run db:check-rpcs
```

## JWT hook

Every analytics RPC reads `auth.jwt() ->> 'tenant_id'`. Configure a Custom Access Token Hook in Supabase Dashboard -> Authentication -> Hooks pointing at `public.custom_access_token_hook` (defined in migration 20261028000058). Without it, all RPCs raise "Missing tenant claim".
