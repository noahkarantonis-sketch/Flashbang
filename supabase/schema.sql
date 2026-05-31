-- ===========================================================================
-- Flashbang — database schema. Run once in the Supabase SQL editor.
-- ===========================================================================

-- One row per user. Holds their plan and this month's AI usage.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free',          -- 'free' | 'pro'
  usage_count int not null default 0,
  usage_period text,                            -- 'YYYY-MM'
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user can read their own profile (to show usage/plan in-app).
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users may NOT write plan/usage themselves — only the Edge Function
-- (service role) touches those. No insert/update policy for normal users.

-- Auto-create a profile row when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- To make yourself (or a tester) a 'pro' user, run:
--   update public.profiles set plan = 'pro' where email = 'you@example.com';
--
-- Later: a Stripe webhook flips plan to 'pro' on payment and back to 'free'
-- on cancellation. That webhook is the only other server piece you need to
-- actually charge the subscription.
-- ---------------------------------------------------------------------------
