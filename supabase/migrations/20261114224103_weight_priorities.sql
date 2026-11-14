-- Peso de cada hábito (puntuación diaria ponderada) y prioridades del día (máximo 3).

alter table public.habits
  add column weight smallint not null default 3
  constraint habits_weight_check check (weight between 1 and 5);

drop function public.create_habit(text, text, text, text, smallint[], smallint, numeric, text);
drop function public.update_habit(uuid, text, text, text, smallint[], smallint, numeric, text);

create function public.create_habit(
  p_name text,
  p_kind text,
  p_unit text,
  p_frequency text,
  p_days smallint[],
  p_times_per_week smallint,
  p_target numeric,
  p_area text default 'desarrollo',
  p_weight smallint default 3
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_days smallint[] := case when p_frequency = 'dias' then private.normalize_days(p_days) end;
  v_tpw smallint := case when p_frequency = 'semanal' then p_times_per_week end;
  v_unit text := case when p_kind = 'cantidad' then btrim(p_unit) end;
  v_target numeric := case when p_kind = 'cantidad' then p_target end;
begin
  insert into public.habits (name, kind, unit, frequency, days, times_per_week, target, area, weight, position)
  values (
    btrim(p_name), p_kind, v_unit, p_frequency, v_days, v_tpw, v_target, coalesce(p_area, 'desarrollo'), coalesce(p_weight, 3),
    coalesce((select max(h.position) from public.habits h where h.deleted_at is null), 0) + 1
  )
  returning id into v_id;

  insert into public.habit_schedules (habit_id, valid_from, frequency, days, times_per_week, target)
  values (v_id, private.user_today(), p_frequency, v_days, v_tpw, v_target);

  return v_id;
end;
$$;

create function public.update_habit(
  p_habit_id uuid,
  p_name text,
  p_unit text,
  p_frequency text,
  p_days smallint[],
  p_times_per_week smallint,
  p_target numeric,
  p_area text default null,
  p_weight smallint default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  h public.habits;
  open_period public.habit_schedules;
  today date := private.user_today();
  v_days smallint[] := case when p_frequency = 'dias' then private.normalize_days(p_days) end;
  v_tpw smallint := case when p_frequency = 'semanal' then p_times_per_week end;
  v_target numeric;
  changed boolean;
begin
  select * into h from public.habits where id = p_habit_id and deleted_at is null for update;
  if not found then
    raise exception 'Hábito no encontrado' using errcode = 'P0002';
  end if;
  v_target := case when h.kind = 'cantidad' then p_target end;

  changed := h.frequency is distinct from p_frequency
    or h.days is distinct from v_days
    or h.times_per_week is distinct from v_tpw
    or h.target is distinct from v_target;

  if changed and h.archived_at is not null then
    raise exception 'Desarchiva el hábito antes de cambiar su frecuencia' using errcode = '22023';
  end if;

  update public.habits
  set name = btrim(p_name),
      unit = case when h.kind = 'cantidad' then btrim(p_unit) end,
      frequency = p_frequency,
      days = v_days,
      times_per_week = v_tpw,
      target = v_target,
      area = coalesce(p_area, h.area),
      weight = coalesce(p_weight, h.weight)
  where id = p_habit_id;

  if not changed then
    return;
  end if;

  select * into open_period from public.habit_schedules
  where habit_id = p_habit_id and valid_to is null
  for update;

  if found and open_period.valid_from = today then
    update public.habit_schedules
    set frequency = p_frequency, days = v_days, times_per_week = v_tpw, target = v_target
    where id = open_period.id;
  else
    if found then
      update public.habit_schedules set valid_to = today - 1 where id = open_period.id;
    end if;
    insert into public.habit_schedules (habit_id, valid_from, frequency, days, times_per_week, target)
    values (p_habit_id, today, p_frequency, v_days, v_tpw, v_target);
  end if;
end;
$$;


revoke execute on function public.create_habit(text, text, text, text, smallint[], smallint, numeric, text, smallint) from public, anon;
revoke execute on function public.update_habit(uuid, text, text, text, smallint[], smallint, numeric, text, smallint) from public, anon;
grant execute on function public.create_habit(text, text, text, text, smallint[], smallint, numeric, text, smallint) to authenticated;
grant execute on function public.update_habit(uuid, text, text, text, smallint[], smallint, numeric, text, smallint) to authenticated;

-- ---------- Prioridades del día ----------

create table public.daily_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  position smallint not null,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, date, position),
  constraint daily_priorities_position_check check (position between 1 and 3),
  constraint daily_priorities_title_check check (char_length(btrim(title)) between 1 and 120)
);

alter table public.daily_priorities enable row level security;
revoke all on table public.daily_priorities from anon, authenticated;
grant select, insert, update, delete on table public.daily_priorities to authenticated;

create policy "daily_priorities: ver las propias" on public.daily_priorities
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "daily_priorities: crear las propias" on public.daily_priorities
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "daily_priorities: editar las propias" on public.daily_priorities
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "daily_priorities: borrar las propias" on public.daily_priorities
  for delete to authenticated using ((select auth.uid()) = user_id);
