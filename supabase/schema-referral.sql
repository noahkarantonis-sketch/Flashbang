-- ===========================================================================
-- Flashbang — referral loop. Run once in the Supabase SQL editor.
-- Rewards are BONUS GENERATIONS (a depleting pool), never free Pro — so the
-- weekly cap stays intact and the cost is pennies (each generation ≈ ½¢).
-- ===========================================================================

alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by  uuid references auth.users(id),
  add column if not exists bonus_balance int not null default 0;

-- Give every existing user a code.
update public.profiles
set referral_code = upper(substr(md5(id::text || random()::text), 1, 6))
where referral_code is null;

-- New users get a code (and a profile) on signup. Extends the existing trigger.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, referral_code)
  values (new.id, new.email, upper(substr(md5(new.id::text || random()::text), 1, 6)))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- (Existing "read own profile" RLS policy already lets a user read these new
--  columns. Users still cannot WRITE them — only the redeem-referral Edge
--  Function, running as service_role, grants rewards.)
