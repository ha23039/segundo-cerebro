-- Objetivos con hitos y fecha límite (F4). Un hábito pertenece a 0 o 1 objetivo.
-- El "ritmo esperado" se calcula en la app a partir de start_date, due_date y los hitos hechos.

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  start_date date not null default private.user_today(),
  due_date date not null,
  status text not null default 'activo',
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint goals_title_check check (char_length(btrim(title)) between 1 and 80),
  constraint goals_description_check check (description is null or char_length(btrim(description)) between 1 and 500),
  constraint goals_status_check check (status in ('activo', 'completado', 'abandonado')),
  constraint goals_dates_check check (due_date >= start_date),
  constraint goals_completed_check check ((status = 'completado') = (completed_at is not null))
);

create index goals_user_idx on public.goals (user_id, due_date) where deleted_at is null;

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  title text not null,
  done boolean not null default false,
  done_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade,
  constraint milestones_title_check check (char_length(btrim(title)) between 1 and 120),
  constraint milestones_done_check check (done = (done_at is not null))
);

create index milestones_goal_idx on public.milestones (goal_id, position);

-- done_at lo fija la base de datos: así nunca queda incoherente con done
create function private.milestones_set_done_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.done_at := case when new.done then coalesce(case when tg_op = 'UPDATE' then old.done_at end, now()) end;
  return new;
end;
$$;

create trigger milestones_set_done_at
  before insert or update on public.milestones
  for each row execute function private.milestones_set_done_at();

alter table public.habits
  add column goal_id uuid,
  add constraint habits_goal_fk foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete set null (goal_id);

create index habits_goal_idx on public.habits (goal_id) where goal_id is not null;

-- ---------- RLS y permisos ----------

alter table public.goals enable row level security;
alter table public.milestones enable row level security;

revoke all on table public.goals, public.milestones from anon, authenticated;
-- goals sin delete: el borrado es lógico (deleted_at) y la purga la hace pg_cron
grant select, insert, update on table public.goals to authenticated;
grant select, insert, update, delete on table public.milestones to authenticated;
grant select, insert, update, delete on table public.goals, public.milestones to service_role;

create policy "goals: ver los propios" on public.goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "goals: crear los propios" on public.goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goals: editar los propios" on public.goals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "milestones: ver los propios" on public.milestones
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "milestones: crear los propios" on public.milestones
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "milestones: editar los propios" on public.milestones
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "milestones: borrar los propios" on public.milestones
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Papelera: purga diaria a las 03:20 UTC ----------

select cron.schedule(
  'purge-goals-trash',
  '20 3 * * *',
  $$delete from public.goals where deleted_at < now() - interval '30 days'$$
);
