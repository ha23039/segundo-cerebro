-- Sesiones de foco (temporizador). Solo se crean desde el temporizador y se pueden borrar, no editar.
-- Un descanso entre sesiones se guarda con kind = 'descanso'. Se asocian opcionalmente a un hábito o a un objetivo.

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'foco',
  started_at timestamptz not null,
  ended_at timestamptz not null,
  planned_minutes smallint not null,
  actual_minutes smallint not null,
  habit_id uuid,
  goal_id uuid,
  created_at timestamptz not null default now(),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete set null (habit_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id),
  constraint focus_kind_check check (kind in ('foco', 'descanso')),
  constraint focus_planned_check check (planned_minutes between 1 and 240),
  constraint focus_order_check check (ended_at > started_at),
  -- Minutos reales = minutos completos transcurridos; las sesiones de menos de 1 minuto no se guardan
  constraint focus_actual_check check (
    actual_minutes >= 1
    and actual_minutes <= planned_minutes
    and actual_minutes = floor(extract(epoch from (ended_at - started_at)) / 60)
  )
);

create index focus_sessions_user_started_idx on public.focus_sessions (user_id, started_at desc);

-- Una sesión no puede terminar en el futuro (se tolera un minuto de desfase del reloj)
create function private.focus_check_times()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.ended_at > now() + interval '1 minute' then
    raise exception 'La sesión no puede terminar en el futuro' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger focus_check_times
  before insert on public.focus_sessions
  for each row execute function private.focus_check_times();

alter table public.focus_sessions enable row level security;

revoke all on table public.focus_sessions from anon, authenticated;
grant select, insert, delete on table public.focus_sessions to authenticated;
grant select, insert, update, delete on table public.focus_sessions to service_role;

create policy "focus_sessions: ver las propias" on public.focus_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "focus_sessions: crear las propias" on public.focus_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "focus_sessions: borrar las propias" on public.focus_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);
