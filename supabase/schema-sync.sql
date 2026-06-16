-- ===========================================================================
-- Flashbang — cloud sync. Run once in the Supabase SQL editor.
-- Stores each user's whole study library (subjects/docs/cards/tests + name)
-- as one JSON row so it follows them across devices (desktop ↔ phone).
-- Device display prefs (theme/accent) stay local per device, by design.
-- ===========================================================================

create table if not exists public.study_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  device     text,                                   -- last device that wrote
  updated_at timestamptz not null default now()
);

alter table public.study_state enable row level security;

-- Unlike profiles (service-role only), the user OWNS their library and
-- reads/writes it directly. RLS keeps each user to their own row.
drop policy if exists "rw own state" on public.study_state;
create policy "rw own state"
  on public.study_state for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Live updates: stream row changes to the owning device while the app is open
-- (RLS still limits each client to its own row). Idempotent — safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'study_state'
  ) then
    alter publication supabase_realtime add table public.study_state;
  end if;
end $$;
