-- Hábitos con horario versionado por periodos y registro diario.

create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_cron;

-- ---------- Validaciones reutilizables ----------

-- Frecuencia: 'dias' con días ISO (1 = lunes … 7 = domingo) sin repetir, o 'semanal' con N de 1 a 7.
create function private.valid_frequency(frequency text, days smallint[], times_per_week smallint)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case frequency
    when 'dias' then
      times_per_week is null
      and days is not null
      and cardinality(days) between 1 and 7
      and days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
      and cardinality(days) = (select count(distinct d) from unnest(days) as d)
    when 'semanal' then
      days is null and times_per_week between 1 and 7
    else false
  end;
$$;

revoke execute on function private.valid_frequency(text, smallint[], smallint) from public, anon;
grant execute on function private.valid_frequency(text, smallint[], smallint) to authenticated;

-- ---------- habits ----------

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  kind text not null,
  unit text,
  -- Plantilla actual: se usa para abrir un periodo nuevo al editar o desarchivar
  frequency text not null,
  days smallint[],
  times_per_week smallint,
  target numeric,
  position integer not null default 0,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint habits_name_check check (char_length(btrim(name)) between 1 and 80),
  constraint habits_kind_check check (kind in ('check', 'cantidad')),
  constraint habits_unit_check check (
    (kind = 'cantidad') = (unit is not null)
    and (unit is null or char_length(btrim(unit)) between 1 and 20)
  ),
  constraint habits_target_check check (
    (kind = 'cantidad') = (target is not null)
    and (target is null or (target > 0 and target <= 100000))
  ),
  constraint habits_frequency_check check (private.valid_frequency(frequency, days, times_per_week))
);

create index habits_user_position_idx on public.habits (user_id, position);

-- ---------- habit_schedules ----------

create table public.habit_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null,
  valid_from date not null,
  valid_to date,
  frequency text not null,
  days smallint[],
  times_per_week smallint,
  target numeric,
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade,
  constraint habit_schedules_range_check check (valid_to is null or valid_to >= valid_from),
  constraint habit_schedules_frequency_check check (private.valid_frequency(frequency, days, times_per_week)),
  constraint habit_schedules_target_check check (target is null or (target > 0 and target <= 100000)),
  -- Un hábito no puede tener dos periodos que se solapen
  constraint habit_schedules_no_overlap exclude using gist (
    habit_id with =,
    daterange(valid_from, valid_to, '[]') with &&
  )
);

create index habit_schedules_user_idx on public.habit_schedules (user_id);

-- ---------- habit_logs ----------

create table public.habit_logs (
  habit_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  value numeric not null,
  updated_at timestamptz not null default now(),
  primary key (habit_id, date),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade,
  constraint habit_logs_value_check check (value > 0 and value <= 100000)
);

create index habit_logs_user_date_idx on public.habit_logs (user_id, date);

-- Solo se registra o corrige hoy y hasta 7 días atrás (según la zona del perfil).
create function private.habit_logs_check_window()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  today date;
begin
  -- Borrados en cascada (purga de la papelera) no se limitan
  if pg_catalog.pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  today := private.user_today();
  if tg_op in ('UPDATE', 'DELETE') and (old.date < today - 7 or old.date > today) then
    raise exception 'Fecha fuera de la ventana de edición' using errcode = '23514';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (new.date < today - 7 or new.date > today) then
    raise exception 'Fecha fuera de la ventana de edición' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger habit_logs_check_window
  before insert or update or delete on public.habit_logs
  for each row execute function private.habit_logs_check_window();

-- ---------- RLS y permisos ----------

alter table public.habits enable row level security;
alter table public.habit_schedules enable row level security;
alter table public.habit_logs enable row level security;

revoke all on table public.habits, public.habit_schedules, public.habit_logs from anon, authenticated;
-- habits sin delete: el borrado es lógico (deleted_at) y la purga la hace pg_cron
grant select, insert, update on table public.habits to authenticated;
grant select, insert, update, delete on table public.habit_schedules to authenticated;
grant select, insert, update, delete on table public.habit_logs to authenticated;

create policy "habits: ver los propios" on public.habits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "habits: crear los propios" on public.habits
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "habits: editar los propios" on public.habits
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "habit_schedules: ver los propios" on public.habit_schedules
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "habit_schedules: crear los propios" on public.habit_schedules
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "habit_schedules: editar los propios" on public.habit_schedules
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "habit_schedules: borrar los propios" on public.habit_schedules
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "habit_logs: ver los propios" on public.habit_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "habit_logs: crear los propios" on public.habit_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "habit_logs: editar los propios" on public.habit_logs
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "habit_logs: borrar los propios" on public.habit_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Papelera: purga diaria a las 03:15 UTC ----------

select cron.schedule(
  'purge-habits-trash',
  '15 3 * * *',
  $$delete from public.habits where deleted_at < now() - interval '30 days'$$
);
