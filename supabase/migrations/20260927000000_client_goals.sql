-- ============================================================
-- client_goals
--
-- One row per client goal. The advisor creates and edits these
-- from admin-client.html; client.html renders them read-only.
--
-- Amounts are entered in TODAY'S money and inflated over the
-- horizon by the goal's own inflation rate. Return, inflation
-- and step-up are all per-goal so that, say, an education goal
-- can assume 10% inflation while a car goal assumes 6%.
-- ============================================================

create table if not exists public.client_goals (
  id                  bigserial primary key,

  client_id           bigint not null
                        references public.form_responses (id)
                        on delete cascade,

  goal_name           text not null,
  notes               text,

  -- Target in today's money. Inflated to the goal date at
  -- inflation_pct before any SIP is solved.
  target_amount_today numeric(14, 2) not null
                        check (target_amount_today > 0),

  -- Whole years only: the step-up SIP applies its increase on
  -- yearly anniversaries, so a part year has no defined step.
  years               integer not null
                        check (years > 0 and years <= 60),

  assumed_return_pct  numeric(5, 2) not null
                        check (assumed_return_pct >= 0
                               and assumed_return_pct <= 50),

  inflation_pct       numeric(5, 2) not null default 6
                        check (inflation_pct >= 0
                               and inflation_pct <= 30),

  -- Annual SIP increase for the step-up figure. 0 = level SIP.
  step_up_pct         numeric(5, 2) not null default 10
                        check (step_up_pct >= 0
                               and step_up_pct <= 100),

  -- Already saved and earmarked for THIS goal. Grown at
  -- assumed_return_pct and deducted from the target, so the SIP
  -- covers only the remaining gap.
  existing_corpus     numeric(14, 2) not null default 0
                        check (existing_corpus >= 0),

  sort_order          integer not null default 0,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists client_goals_client_id_idx
  on public.client_goals (client_id);

create index if not exists client_goals_client_sort_idx
  on public.client_goals (client_id, sort_order, id);

-- Keep updated_at honest.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists client_goals_set_updated_at on public.client_goals;

create trigger client_goals_set_updated_at
  before update on public.client_goals
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
--
-- !! READ THIS BEFORE RUNNING IN PRODUCTION !!
--
-- Both admin-client.html and client.html are static pages that
-- talk to Supabase with the publishable anon key, and neither
-- has any login. There is therefore no database-level way to
-- tell "the advisor" from "a visitor" -- the policies below
-- grant the anon role full read AND write on client_goals,
-- which mirrors how advisor_observations is already written
-- from the unauthenticated admin.html page.
--
-- The practical consequence: anyone who reads the page source,
-- takes the anon key and calls the REST API can list, add,
-- change or delete any client's goals.
--
-- To close that hole, put the advisor behind Supabase Auth and
-- replace the three write policies with `to authenticated`
-- versions. The read policy can then also be tightened to
-- require a matching access_token. Nothing in the application
-- code below depends on these policies being permissive, so
-- swapping them does not require a code change beyond adding
-- a login.
-- ============================================================

alter table public.client_goals enable row level security;

drop policy if exists client_goals_read   on public.client_goals;
drop policy if exists client_goals_insert on public.client_goals;
drop policy if exists client_goals_update on public.client_goals;
drop policy if exists client_goals_delete on public.client_goals;

create policy client_goals_read
  on public.client_goals
  for select
  to anon, authenticated
  using (true);

create policy client_goals_insert
  on public.client_goals
  for insert
  to anon, authenticated
  with check (true);

create policy client_goals_update
  on public.client_goals
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy client_goals_delete
  on public.client_goals
  for delete
  to anon, authenticated
  using (true);
