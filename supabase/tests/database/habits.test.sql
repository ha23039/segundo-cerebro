begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ha@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'hb@test.local', 'authenticated', 'authenticated');

-- ===== Usuario A =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.habits (id, name, kind, frequency, days)
values ('11111111-aaaa-0000-0000-000000000001', 'Leer', 'check', 'dias', '{1,3,5}');
insert into public.habit_schedules (habit_id, valid_from, frequency, days)
values ('11111111-aaaa-0000-0000-000000000001', private.user_today() - 30, 'dias', '{1,3,5}');

select lives_ok(
  $$insert into public.habit_logs (habit_id, date, value)
    values ('11111111-aaaa-0000-0000-000000000001', private.user_today(), 1)$$,
  'registrar hoy funciona'
);
select lives_ok(
  $$insert into public.habit_logs (habit_id, date, value)
    values ('11111111-aaaa-0000-0000-000000000001', private.user_today() - 7, 1)$$,
  'registrar hace 7 días funciona'
);
select throws_ok(
  $$insert into public.habit_logs (habit_id, date, value)
    values ('11111111-aaaa-0000-0000-000000000001', private.user_today() - 8, 1)$$,
  '23514', 'Fecha fuera de la ventana de edición',
  'registrar hace 8 días falla'
);
select throws_ok(
  $$insert into public.habit_logs (habit_id, date, value)
    values ('11111111-aaaa-0000-0000-000000000001', private.user_today() + 1, 1)$$,
  '23514', 'Fecha fuera de la ventana de edición',
  'registrar mañana falla'
);
select throws_ok(
  $$insert into public.habit_logs (habit_id, date, value)
    values ('11111111-aaaa-0000-0000-000000000001', private.user_today() - 1, 0)$$,
  '23514', null,
  'valor 0 falla'
);
select throws_ok(
  $$insert into public.habit_schedules (habit_id, valid_from, frequency, days)
    values ('11111111-aaaa-0000-0000-000000000001', private.user_today() - 5, 'dias', '{1}')$$,
  '23P01', null,
  'periodos solapados del mismo hábito fallan'
);
select throws_ok(
  $$insert into public.habits (name, kind, unit, frequency, times_per_week)
    values ('Agua', 'cantidad', 'vasos', 'semanal', 5)$$,
  '23514', null,
  'hábito de cantidad sin meta falla'
);
select throws_ok(
  $$insert into public.habits (name, kind, frequency, days) values ('Nada', 'check', 'dias', '{}')$$,
  '23514', null,
  'frecuencia por días sin días falla'
);
select throws_ok(
  $$insert into public.habits (name, kind, frequency, days) values ('Repetido', 'check', 'dias', '{1,1}')$$,
  '23514', null,
  'días repetidos fallan'
);
select throws_ok(
  $$insert into public.habits (name, kind, frequency, times_per_week) values ('   ', 'check', 'semanal', 3)$$,
  '23514', null,
  'nombre vacío falla'
);
select throws_ok(
  $$delete from public.habits where id = '11111111-aaaa-0000-0000-000000000001'$$,
  '42501', null,
  'el borrado definitivo no está permitido (se usa la papelera)'
);

-- ===== Usuario B =====
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from public.habits) + (select count(*)::int from public.habit_schedules)
    + (select count(*)::int from public.habit_logs),
  0,
  'B no ve hábitos, horarios ni registros de A'
);
select throws_ok(
  $$insert into public.habit_logs (habit_id, date, value)
    values ('11111111-aaaa-0000-0000-000000000001', private.user_today() - 2, 1)$$,
  '23503', null,
  'B no puede registrar en el hábito de A (FK compuesta)'
);
select throws_ok(
  $$insert into public.habit_logs (habit_id, user_id, date, value)
    values ('11111111-aaaa-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', private.user_today(), 1)$$,
  '42501', null,
  'B no puede escribir filas con el user_id de A (RLS)'
);
update public.habits set name = 'Hackeado' where id = '11111111-aaaa-0000-0000-000000000001';

-- ===== Comprobaciones como postgres =====
reset role;
select is(
  (select name from public.habits where id = '11111111-aaaa-0000-0000-000000000001'),
  'Leer',
  'B no puede modificar el hábito de A'
);

-- Registro antiguo insertado saltando triggers, para probar el borrado fuera de ventana
set local session_replication_role = replica;
insert into public.habit_logs (habit_id, user_id, date, value)
values ('11111111-aaaa-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        (now() at time zone 'Europe/Madrid')::date - 20, 1);
set local session_replication_role = origin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$delete from public.habit_logs
    where habit_id = '11111111-aaaa-0000-0000-000000000001' and date = private.user_today() - 20$$,
  '23514', 'Fecha fuera de la ventana de edición',
  'borrar un registro de hace 20 días falla'
);

reset role;
select lives_ok(
  $$delete from public.habits where id = '11111111-aaaa-0000-0000-000000000001'$$,
  'la purga (como postgres) borra en cascada aunque haya registros antiguos'
);
select is(
  (select count(*)::int from cron.job where jobname = 'purge-habits-trash'),
  1,
  'existe el job diario de purga de la papelera'
);

select * from finish();
rollback;
