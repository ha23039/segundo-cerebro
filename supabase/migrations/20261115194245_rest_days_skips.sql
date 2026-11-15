-- Días de descanso planificados y omisiones justificadas de un hábito.
-- Ninguno de los dos puntúa ni rompe rachas: el día (o el hábito ese día) queda excusado.

-- Ventana de fechas común: corregir hasta 7 días atrás y planificar hasta 90 días adelante
-- (según la zona horaria del perfil). Las cascadas (purga de la papelera) no se limitan.
create function private.excuse_check_window()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  today date;
begin
  if pg_catalog.pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  today := private.user_today();
  if tg_op in ('UPDATE', 'DELETE') and (old.date < today - 7 or old.date > today + 90) then
    raise exception 'Fecha fuera de la ventana de planificación' using errcode = '23514';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (new.date < today - 7 or new.date > today + 90) then
    raise exception 'Fecha fuera de la ventana de planificación' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

-- ---------- rest_days ----------

create table public.rest_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, date),
  constraint rest_days_note_check check (note is null or char_length(btrim(note)) between 1 and 120)
);

create trigger rest_days_check_window
  before insert or update or delete on public.rest_days
  for each row execute function private.excuse_check_window();

-- ---------- habit_skips ----------

create table public.habit_skips (
  habit_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, date),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade,
  constraint habit_skips_reason_check check (reason in ('enfermedad', 'viaje', 'imprevisto', 'descanso', 'otro'))
);

create index habit_skips_user_date_idx on public.habit_skips (user_id, date);

create trigger habit_skips_check_window
  before insert or update or delete on public.habit_skips
  for each row execute function private.excuse_check_window();

-- ---------- RLS y permisos ----------

alter table public.rest_days enable row level security;
alter table public.habit_skips enable row level security;

revoke all on table public.rest_days, public.habit_skips from anon, authenticated;
grant select, insert, update, delete on table public.rest_days, public.habit_skips to authenticated;
grant select, insert, update, delete on table public.rest_days, public.habit_skips to service_role;

create policy "rest_days: ver los propios" on public.rest_days
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "rest_days: crear los propios" on public.rest_days
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "rest_days: editar los propios" on public.rest_days
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "rest_days: borrar los propios" on public.rest_days
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "habit_skips: ver las propias" on public.habit_skips
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "habit_skips: crear las propias" on public.habit_skips
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "habit_skips: editar las propias" on public.habit_skips
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "habit_skips: borrar las propias" on public.habit_skips
  for delete to authenticated using ((select auth.uid()) = user_id);
