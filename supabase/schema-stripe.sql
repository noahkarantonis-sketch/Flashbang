-- ===========================================================================
-- Flashbang — Stripe billing columns. Run once in the Supabase SQL editor
-- (after schema.sql). Safe to re-run.
-- ===========================================================================

alter table public.profiles
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan_status            text,        -- active | canceled | past_due | trialing
  add column if not exists current_period_end     timestamptz;

create index if not exists profiles_stripe_customer_idx
  on public.profiles(stripe_customer_id);

-- The webhook (service role) is the ONLY writer of these columns; RLS already
-- blocks normal users from writing their own plan, so no policy change needed.
