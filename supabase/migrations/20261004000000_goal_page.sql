-- ============================================================
-- Goal page: prospects and shareable goal links
--
-- Adds what goal.html needs on top of client_goals:
--
--   * a goal can belong to a PROSPECT who has not filled the
--     onboarding form, so client_mobile_number becomes nullable
--     and prospect name/mobile are held on the goal itself;
--   * every goal gets a share_token so a single goal can be sent
--     to a prospect via goal-share.html, without exposing the
--     client's own access_token;
--   * `notes` is renamed to goal_description, which is what the
--     page actually collects. Nothing read it before, so the
--     rename is safe.
--
-- Run this AFTER 20260927000000_client_goals.sql.
-- ============================================================

-- ---------- prospects ----------

alter table public.client_goals
  alter column client_mobile_number drop not null;

alter table public.client_goals
  add column if not exists prospect_name text;

-- Free text, not a bigint like form_responses.mobile_number: a
-- prospect's number may be unverified, carry a country code or a
-- leading zero, and must not collide with the clients table.
alter table public.client_goals
  add column if not exists prospect_mobile text;

-- A goal belongs to exactly one of: an onboarded client, or a
-- named prospect. Never neither.
alter table public.client_goals
  drop constraint if exists client_goals_owner_present;

alter table public.client_goals
  add constraint client_goals_owner_present
  check (
    client_mobile_number is not null
    or nullif(btrim(coalesce(prospect_name, '')), '') is not null
  );

-- ---------- shareable link ----------

alter table public.client_goals
  add column if not exists share_token text;

-- Backfill any rows created by the inline panel before this ran.
update public.client_goals
   set share_token = gen_random_uuid()::text
 where share_token is null;

alter table public.client_goals
  alter column share_token set default gen_random_uuid()::text;

alter table public.client_goals
  alter column share_token set not null;

create unique index if not exists client_goals_share_token_idx
  on public.client_goals (share_token);

-- ---------- description ----------

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'client_goals'
       and column_name = 'notes'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'client_goals'
       and column_name = 'goal_description'
  ) then
    alter table public.client_goals rename column notes to goal_description;
  end if;
end $$;

alter table public.client_goals
  add column if not exists goal_description text;

-- ============================================================
-- RLS is unchanged.
--
-- The existing client_goals_read policy is `using (true)`, so a
-- share_token lookup already works. Note what that means: the
-- token is not what grants access -- the anon key does, and the
-- filter is applied client-side. Anyone with the anon key can
-- read every goal regardless of token, exactly as before.
--
-- If you later put the advisor behind Supabase Auth, the read
-- policy is the one to tighten so a share_token (or a client's
-- access_token) is genuinely required.
-- ============================================================
