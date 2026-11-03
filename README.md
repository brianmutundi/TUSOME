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

## Balance formula

Balance = applicable charges − allocated successful payments − applied credits − approved waivers + reversals.

- Legacy unallocated payments are counted in `fee_payments` (total_paid) and never double-counted.
- `get_fee_balances` and `get_finance_summary` use `total_fees - total_paid` from source records.
- Credit allocation lines (kind='credit' in payment_allocations) provide votehead-level detail but don't change the balance (payment amount is the source of truth).
- Overpayments create a credit allocation line so allocations sum exactly to the payment amount.
- Credit carries forward and is applied to later charges. Refunds are out of scope.