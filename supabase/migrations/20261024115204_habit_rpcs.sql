-- Operaciones de hábitos que tocan varias filas. Todas security invoker (RLS aplica)
-- y usan private.user_today() como "hoy": nunca una fecha enviada por el cliente.

create function private.normalize_days(days smallint[])
returns smallint[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select case when days is null then null
    else array(select distinct d from unnest(days) as d order by d) end;
$$;

revoke execute on function private.normalize_days(smallint[]) from public, anon;
grant execute on function private.normalize_days(smallint[]) to authenticated;

-- ---------- create_habit ----------

create function public.create_habit(
  p_name text,
  p_kind text,
  p_unit text,
  p_frequency text,
  p_days smallint[],
  p_times_per_week smallint,
  p_target numeric
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
  insert into public.habits (name, kind, unit, frequency, days, times_per_week, target, position)
  values (
    btrim(p_name), p_kind, v_unit, p_frequency, v_days, v_tpw, v_target,
    coalesce((select max(h.position) from public.habits h where h.deleted_at is null), 0) + 1
  )
  returning id into v_id;

  insert into public.habit_schedules (habit_id, valid_from, frequency, days, times_per_week, target)
  values (v_id, private.user_today(), p_frequency, v_days, v_tpw, v_target);

  return v_id;
end;
$$;

-- ---------- update_habit ----------

create function public.update_habit(
  p_habit_id uuid,
  p_name text,
  p_unit text,
  p_frequency text,
  p_days smallint[],
  p_times_per_week smallint,
  p_target numeric
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
      target = v_target
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

-- ---------- archive_habit / unarchive_habit ----------

create function public.archive_habit(p_habit_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  today date := private.user_today();
begin
  update public.habits set archived_at = now()
  where id = p_habit_id and deleted_at is null and archived_at is null;
  if not found then
    raise exception 'Hábito no encontrado' using errcode = 'P0002';
  end if;

  -- El periodo abierto termina ayer; si empezó hoy, desaparece
  delete from public.habit_schedules
  where habit_id = p_habit_id and valid_to is null and valid_from >= today;
  update public.habit_schedules set valid_to = today - 1
  where habit_id = p_habit_id and valid_to is null;
end;
$$;

create function public.unarchive_habit(p_habit_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  h public.habits;
begin
  update public.habits set archived_at = null
  where id = p_habit_id and deleted_at is null and archived_at is not null
  returning * into h;
  if not found then
    raise exception 'Hábito no encontrado' using errcode = 'P0002';
  end if;

  insert into public.habit_schedules (habit_id, valid_from, frequency, days, times_per_week, target)
  values (p_habit_id, private.user_today(), h.frequency, h.days, h.times_per_week, h.target);
end;
$$;

-- ---------- move_habit ----------

create function public.move_habit(p_habit_id uuid, p_direction text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ordered uuid[];
  idx integer;
  other integer;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'Dirección no válida' using errcode = '22023';
  end if;

  -- Orden actual de los hábitos activos (renumerado 1..n para evitar empates)
  select array_agg(h.id order by h.position, h.created_at) into ordered
  from public.habits h
  where h.deleted_at is null and h.archived_at is null;

  idx := array_position(ordered, p_habit_id);
  if idx is null then
    raise exception 'Hábito no encontrado' using errcode = 'P0002';
  end if;
  other := case when p_direction = 'up' then idx - 1 else idx + 1 end;
  if other < 1 or other > cardinality(ordered) then
    return;
  end if;

  ordered[idx] := ordered[other];
  ordered[other] := p_habit_id;

  update public.habits h set position = o.n
  from unnest(ordered) with ordinality as o(id, n)
  where h.id = o.id and h.position is distinct from o.n;
end;
$$;

-- ---------- Permisos ----------

revoke execute on function public.create_habit(text, text, text, text, smallint[], smallint, numeric) from public, anon;
revoke execute on function public.update_habit(uuid, text, text, text, smallint[], smallint, numeric) from public, anon;
revoke execute on function public.archive_habit(uuid) from public, anon;
revoke execute on function public.unarchive_habit(uuid) from public, anon;
revoke execute on function public.move_habit(uuid, text) from public, anon;

grant execute on function public.create_habit(text, text, text, text, smallint[], smallint, numeric) to authenticated;
grant execute on function public.update_habit(uuid, text, text, text, smallint[], smallint, numeric) to authenticated;
grant execute on function public.archive_habit(uuid) to authenticated;
grant execute on function public.unarchive_habit(uuid) to authenticated;
grant execute on function public.move_habit(uuid, text) to authenticated;
