-- Allow negative amounts in payment_allocations for reversal mirrors
alter table public.payment_allocations drop constraint if exists payment_allocations_amount_check;
alter table public.payment_allocations add constraint payment_allocations_amount_check check (amount <> 0);
