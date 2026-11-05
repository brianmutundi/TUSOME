-- Add fee_structure_id to fee_waivers so per-line waivers can be tracked.
alter table public.fee_waivers
  add column if not exists fee_structure_id uuid references public.fee_structures (id) on delete set null;

create index if not exists idx_fee_waivers_fee_structure_id
  on public.fee_waivers (fee_structure_id);
