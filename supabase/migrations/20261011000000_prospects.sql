-- ============================================================
-- prospects
--
-- Until now a prospect existed only as free text on each goal
-- (prospect_name / prospect_mobile). Nothing tied two goals to
-- the same person: "+91 90000 11111" and "9000011111" are
-- different strings, so one typo silently split a prospect in
-- two, and every goal produced its own share link.
--
-- This gives a prospect a real row, so goals can be grouped and
-- a single summary link can cover all of them.
--
-- Run AFTER 20261004000000_goal_page.sql.
-- ============================================================

create table if not exists public.prospects (
  id           bigserial primary key,

  full_name    text not null
                 check (btrim(full_name) <> ''),

  -- Free text: may carry a country code, spaces or a leading
  -- zero, and must not collide with form_responses.mobile_number.
  mobile       text,

  -- Person-level share link for summary.html.
  share_token  text not null default gen_random_uuid()::text,

  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists prospects_share_token_idx
  on public.prospects (share_token);

-- Stop the same person being created twice. Name is compared
-- case- and space-insensitively; mobile is compared on digits
-- only, so "+91 90000 11111" and "9000011111" collide as they
-- should. A prospect with no mobile is keyed on name alone.
create unique index if not exists prospects_identity_idx
  on public.prospects (
    lower(btrim(full_name)),
    coalesce(regexp_replace(coalesce(mobile, ''), '\D', '', 'g'), '')
  );

drop trigger if exists prospects_set_updated_at on public.prospects;

create trigger prospects_set_updated_at
  before update on public.prospects
  for each row
  execute function public.set_updated_at();

-- ---------- link goals to prospects ----------

alter table public.client_goals
  add column if not exists prospect_id bigint
    references public.prospects (id) on delete cascade;

create index if not exists client_goals_prospect_id_idx
  on public.client_goals (prospect_id);

-- ---------- backfill existing prospect goals ----------

-- One prospects row per distinct name+digits already in use.
insert into public.prospects (full_name, mobile)
select distinct on (
         lower(btrim(g.prospect_name)),
         regexp_replace(coalesce(g.prospect_mobile, ''), '\D', '', 'g')
       )
       btrim(g.prospect_name),
       nullif(btrim(coalesce(g.prospect_mobile, '')), '')
  from public.client_goals g
 where g.prospect_id is null
   and nullif(btrim(coalesce(g.prospect_name, '')), '') is not null
 order by lower(btrim(g.prospect_name)),
          regexp_replace(coalesce(g.prospect_mobile, ''), '\D', '', 'g'),
          g.id
on conflict do nothing;

update public.client_goals g
   set prospect_id = p.id
  from public.prospects p
 where g.prospect_id is null
   and nullif(btrim(coalesce(g.prospect_name, '')), '') is not null
   and lower(btrim(g.prospect_name)) = lower(btrim(p.full_name))
   and regexp_replace(coalesce(g.prospect_mobile, ''), '\D', '', 'g')
     = regexp_replace(coalesce(p.mobile, ''), '\D', '', 'g');

-- ---------- a goal still needs exactly one owner ----------

alter table public.client_goals
  drop constraint if exists client_goals_owner_present;

alter table public.client_goals
  add constraint client_goals_owner_present
  check (client_mobile_number is not null or prospect_id is not null);

-- NOTE: client_goals.prospect_name and prospect_mobile are now
-- DEPRECATED and no longer written by the application. They are
-- left in place so nothing already saved is lost; read the
-- prospect's name from public.prospects instead. They can be
-- dropped once you are satisfied the backfill above is correct:
--
--   alter table public.client_goals drop column prospect_name;
--   alter table public.client_goals drop column prospect_mobile;

-- ---------- RLS ----------
--
-- Same posture as client_goals: the pages are static and use the
-- publishable anon key with no login, so a share token filters
-- rather than grants. Tighten these together with client_goals
-- if the advisor is ever put behind Supabase Auth.

alter table public.prospects enable row level security;

drop policy if exists prospects_read   on public.prospects;
drop policy if exists prospects_insert on public.prospects;
drop policy if exists prospects_update on public.prospects;
drop policy if exists prospects_delete on public.prospects;

create policy prospects_read
  on public.prospects for select
  to anon, authenticated using (true);

create policy prospects_insert
  on public.prospects for insert
  to anon, authenticated with check (true);

create policy prospects_update
  on public.prospects for update
  to anon, authenticated using (true) with check (true);

create policy prospects_delete
  on public.prospects for delete
  to anon, authenticated using (true);
