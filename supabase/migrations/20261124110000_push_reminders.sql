-- Recordatorios con notificaciones push (Web Push). La BD decide QUÉ avisar y CUÁNDO (due_reminders);
-- una Edge Function solo envía lo que la BD devuelve. Las claves VAPID viven en los secretos de la función, nunca aquí.

-- ---------- Preferencias (por usuario, viajan con la cuenta) ----------
-- Forma: {"enabled": true, "habitTimes": true, "evening": true, "eveningTime": "21:00", "review": true}
-- Sin "enabled" no se envía nada. Lo demás tiene valores por defecto en due_reminders.

alter table public.profiles
  add column reminders jsonb not null default '{}'::jsonb,
  add constraint profiles_reminders_check check (
    jsonb_typeof(reminders) = 'object'
    and pg_column_size(reminders) <= 500
    and (reminders -> 'enabled' is null or jsonb_typeof(reminders -> 'enabled') = 'boolean')
    and (reminders -> 'habitTimes' is null or jsonb_typeof(reminders -> 'habitTimes') = 'boolean')
    and (reminders -> 'evening' is null or jsonb_typeof(reminders -> 'evening') = 'boolean')
    and (reminders -> 'review' is null or jsonb_typeof(reminders -> 'review') = 'boolean')
    and (reminders ->> 'eveningTime' is null or reminders ->> 'eveningTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  );

grant update (reminders) on table public.profiles to authenticated;

-- ---------- Dispositivos suscritos ----------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint),
  constraint push_subscriptions_endpoint_check check (endpoint ~ '^https://' and char_length(endpoint) <= 2000),
  constraint push_subscriptions_keys_check check (char_length(p256dh) between 1 and 200 and char_length(auth) between 1 and 100)
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------- Registro de avisos enviados (evita duplicados; solo lo toca el servicio) ----------

create table public.reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  ref text not null,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref, day),
  constraint reminder_log_kind_check check (kind in ('habito', 'repaso', 'revision'))
);

alter table public.push_subscriptions enable row level security;
alter table public.reminder_log enable row level security;

revoke all on table public.push_subscriptions, public.reminder_log from anon, authenticated;
grant select, insert, delete on table public.push_subscriptions to authenticated;
grant select, insert, update, delete on table public.push_subscriptions, public.reminder_log to service_role;

create policy "push_subscriptions: ver las propias" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "push_subscriptions: crear las propias" on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "push_subscriptions: borrar las propias" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);
-- reminder_log: RLS activo y sin políticas para usuarios; el rol de servicio la salta.

-- ---------- Hábitos que siguen pendientes un día ----------
-- Programados ese día y sin hacer ni omitir. `dias`: toca ese día de la semana; `semanal`: aún no llega al objetivo de la semana.

create function private.pending_habits(p_user uuid, p_day date)
returns table (habit_id uuid, name text, start_time time)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.id, h.name, h.start_time
  from public.habits h
  join public.habit_schedules s
    on s.habit_id = h.id and s.valid_from <= p_day and (s.valid_to is null or s.valid_to >= p_day)
  where h.user_id = p_user
    and h.deleted_at is null
    and h.archived_at is null
    and not exists (select 1 from public.habit_skips k where k.habit_id = h.id and k.date = p_day)
    and not exists (
      select 1 from public.habit_logs l
      where l.habit_id = h.id and l.date = p_day
        and (h.kind = 'check' or l.value >= coalesce(s.target, h.target, 0))
    )
    and (
      (s.frequency = 'dias' and extract(isodow from p_day)::smallint = any (s.days))
      or (
        s.frequency = 'semanal'
        and (
          select count(*) from public.habit_logs l2
          where l2.habit_id = h.id and l2.date >= date_trunc('week', p_day)::date and l2.date <= p_day
        ) < s.times_per_week
      )
    );
$$;

revoke all on function private.pending_habits(uuid, date) from public, anon, authenticated;

-- ---------- Qué hay que avisar ahora ----------
-- Ventana de 15 minutos desde la hora prevista: un aviso tardío es peor que ninguno. Cada aviso se envía una vez al día
-- (reminder_log). Cubre hábitos con hora de inicio, el repaso de la tarde (hábitos que quedan) y la revisión semanal del domingo.

create function public.due_reminders(p_now timestamptz default now())
returns table (user_id uuid, kind text, ref text, day date, title text, body text, url text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  u record;
  v_local timestamp;
  v_day date;
  v_time time;
  v_left integer;
  v_at time;
begin
  for u in
    select p.user_id as uid, p.timezone, p.reminders
    from public.profiles p
    where coalesce((p.reminders ->> 'enabled')::boolean, false)
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.user_id)
  loop
    v_local := p_now at time zone u.timezone;
    v_day := v_local::date;
    v_time := v_local::time;

    -- Un día de descanso lo excusa todo
    if exists (select 1 from public.rest_days r where r.user_id = u.uid and r.date = v_day) then
      continue;
    end if;

    -- 1. Hábitos con hora de inicio
    if coalesce((u.reminders ->> 'habitTimes')::boolean, true) then
      return query
      select u.uid, 'habito'::text, d.habit_id::text, v_day, d.name, 'Toca ahora'::text, '/'::text
      from private.pending_habits(u.uid, v_day) d
      where d.start_time is not null
        and v_time >= d.start_time and v_time < d.start_time + interval '15 minutes'
        and not exists (select 1 from public.reminder_log g where g.user_id = u.uid and g.kind = 'habito' and g.ref = d.habit_id::text and g.day = v_day);
    end if;

    -- 2. Repaso de la tarde
    if coalesce((u.reminders ->> 'evening')::boolean, true) then
      v_at := coalesce((u.reminders ->> 'eveningTime')::time, time '21:00');
      if v_time >= v_at and v_time < v_at + interval '15 minutes'
         and not exists (select 1 from public.reminder_log g where g.user_id = u.uid and g.kind = 'repaso' and g.ref = '' and g.day = v_day) then
        select count(*) into v_left from private.pending_habits(u.uid, v_day);
        if v_left > 0 then
          return query select u.uid, 'repaso'::text, ''::text, v_day,
            'Repaso del día'::text,
            case when v_left = 1 then 'Te queda 1 hábito por hacer hoy' else 'Te quedan ' || v_left || ' hábitos por hacer hoy' end,
            '/'::text;
        end if;
      end if;
    end if;

    -- 3. Revisión semanal (domingo a las 19:00 si aún no la has hecho)
    if coalesce((u.reminders ->> 'review')::boolean, true)
       and extract(isodow from v_day) = 7
       and v_time >= time '19:00' and v_time < time '19:15'
       and not exists (select 1 from public.weekly_reviews w where w.user_id = u.uid and w.week_start = date_trunc('week', v_day)::date)
       and not exists (select 1 from public.reminder_log g where g.user_id = u.uid and g.kind = 'revision' and g.ref = '' and g.day = v_day) then
      return query select u.uid, 'revision'::text, ''::text, v_day, 'Revisión semanal'::text, 'Cuenta cómo fue la semana y elige el foco de la próxima'::text, '/revision'::text;
    end if;
  end loop;
end;
$$;

revoke all on function public.due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.due_reminders(timestamptz) to service_role;

-- Los avisos ya enviados se conservan 14 días: purga diaria a las 03:50 UTC
select cron.schedule(
  'purge-reminder-log',
  '50 3 * * *',
  $$delete from public.reminder_log where day < current_date - 14$$
);
