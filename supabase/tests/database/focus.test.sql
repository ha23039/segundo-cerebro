begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role) values
  ('eeeeeeee-7777-0000-0000-000000000001', 'f1@test.local', 'authenticated', 'authenticated'),
  ('eeeeeeee-7777-0000-0000-000000000002', 'f2@test.local', 'authenticated', 'authenticated');
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

select ok((select relrowsecurity from pg_class where oid = 'public.focus_sessions'::regclass), 'RLS activo en focus_sessions');
select ok(not has_table_privilege('anon', 'public.focus_sessions', 'select'), 'anon no lee focus_sessions');
select ok(not has_table_privilege('authenticated', 'public.focus_sessions', 'update'), 'las sesiones no se editan');

set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-7777-0000-0000-000000000001","role":"authenticated"}';

insert into ids values ('h', public.create_habit('Estudiar', 'check', null, 'dias', '{1}', null, null));

-- 25 minutos completos, asociada a un hábito
select lives_ok(
  $$insert into public.focus_sessions (started_at, ended_at, planned_minutes, actual_minutes, habit_id)
    values (now() - interval '30 minutes', now() - interval '5 minutes', 25, 25, (select id from ids where name = 'h'))$$,
  'guarda una sesión de foco completa'
);
-- Detenida a los 7 min 40 s: cuentan 7 minutos
select lives_ok(
  $$insert into public.focus_sessions (started_at, ended_at, planned_minutes, actual_minutes)
    values (now() - interval '20 minutes', now() - interval '20 minutes' + interval '7 minutes 40 seconds', 25, 7)$$,
  'guarda una sesión detenida antes de tiempo'
);
select lives_ok(
  $$insert into public.focus_sessions (kind, started_at, ended_at, planned_minutes, actual_minutes)
    values ('descanso', now() - interval '10 minutes', now() - interval '5 minutes', 5, 5)$$,
  'guarda un descanso'
);

select throws_ok(
  $$insert into public.focus_sessions (started_at, ended_at, planned_minutes, actual_minutes)
    values (now() - interval '30 seconds', now(), 25, 0)$$,
  '23514', null, 'menos de 1 minuto no se guarda'
);
select throws_ok(
  $$insert into public.focus_sessions (started_at, ended_at, planned_minutes, actual_minutes)
    values (now() - interval '10 minutes', now(), 25, 9)$$,
  '23514', null, 'los minutos reales deben coincidir con el tiempo transcurrido'
);
select throws_ok(
  $$insert into public.focus_sessions (started_at, ended_at, planned_minutes, actual_minutes)
    values (now() - interval '30 minutes', now(), 25, 30)$$,
  '23514', null, 'los minutos reales no superan los planificados'
);
select throws_ok(
  $$insert into public.focus_sessions (kind, started_at, ended_at, planned_minutes, actual_minutes)
    values ('siesta', now() - interval '10 minutes', now(), 10, 10)$$,
  '23514', null, 'tipo fuera de la lista'
);
select throws_ok(
  $$insert into public.focus_sessions (started_at, ended_at, planned_minutes, actual_minutes)
    values (now() + interval '1 hour', now() + interval '1 hour 10 minutes', 10, 10)$$,
  '23514', null, 'no se puede terminar en el futuro'
);

-- Aislamiento entre usuarios
set local request.jwt.claims = '{"sub":"eeeeeeee-7777-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.focus_sessions), 0, 'B no ve las sesiones de A');
select throws_ok(
  $$insert into public.focus_sessions (started_at, ended_at, planned_minutes, actual_minutes, habit_id)
    values (now() - interval '10 minutes', now(), 10, 10, (select id from ids where name = 'h'))$$,
  '23503', null, 'B no puede asociar su sesión al hábito de A'
);
delete from public.focus_sessions;

set local request.jwt.claims = '{"sub":"eeeeeeee-7777-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.focus_sessions), 3, 'B no borró las sesiones de A');
delete from public.focus_sessions where kind = 'descanso';
select is((select count(*)::int from public.focus_sessions), 2, 'A borra una sesión suya');

-- Purgar el hábito no borra la sesión: queda sin asociar
reset role;
delete from public.habits;
select ok(
  (select count(*) = 2 and bool_and(habit_id is null) from public.focus_sessions where user_id = 'eeeeeeee-7777-0000-0000-000000000001'),
  'la sesión sobrevive sin hábito'
);

select * from finish();
rollback;
