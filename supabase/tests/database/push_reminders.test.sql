begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email, aud, role) values
  ('eeeeeeee-aaaa-0000-0000-000000000001', 'p1@test.local', 'authenticated', 'authenticated'),
  ('eeeeeeee-aaaa-0000-0000-000000000002', 'p2@test.local', 'authenticated', 'authenticated');

select ok((select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass), 'RLS activo en push_subscriptions');
select ok((select relrowsecurity from pg_class where oid = 'public.reminder_log'::regclass), 'RLS activo en reminder_log');
select ok(not has_table_privilege('authenticated', 'public.reminder_log', 'select'), 'los usuarios no leen el registro de avisos');
select ok(not has_function_privilege('authenticated', 'public.due_reminders(timestamptz)', 'execute'), 'los usuarios no ejecutan due_reminders');
select ok(has_function_privilege('service_role', 'public.due_reminders(timestamptz)', 'execute'), 'el servicio sí ejecuta due_reminders');

-- Datos del usuario 1. Se siembran saltando los triggers (las ventanas de edición dependen del día real y harían el test frágil)
set local session_replication_role = replica;
-- Madrid en invierno es UTC+1: 07:05 UTC = 08:05 en Madrid. 2026-11-24 es martes.
insert into public.habits (id, user_id, name, kind, unit, target, frequency, days, position, start_time) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-aaaa-0000-0000-000000000001', 'Leer', 'check', null, null, 'dias', array[1,2,3,4,5,6,7]::smallint[], 1, '08:00'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'eeeeeeee-aaaa-0000-0000-000000000001', 'Agua', 'cantidad', 'vasos', 8, 'dias', array[1,2,3,4,5,6,7]::smallint[], 2, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'eeeeeeee-aaaa-0000-0000-000000000001', 'Solo fin de semana', 'check', null, null, 'dias', array[6,7]::smallint[], 3, '08:00');
insert into public.habit_schedules (habit_id, user_id, valid_from, frequency, days, target) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-aaaa-0000-0000-000000000001', '2026-01-01', 'dias', array[1,2,3,4,5,6,7]::smallint[], null),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'eeeeeeee-aaaa-0000-0000-000000000001', '2026-01-01', 'dias', array[1,2,3,4,5,6,7]::smallint[], 8),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'eeeeeeee-aaaa-0000-0000-000000000001', '2026-01-01', 'dias', array[6,7]::smallint[], null);

-- Sin recordatorios activados no se avisa nada
select is((select count(*)::int from public.due_reminders('2026-11-24 07:05:00+00')), 0, 'sin activar no hay avisos');

insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('eeeeeeee-aaaa-0000-0000-000000000001', 'https://push.example.test/abc', 'BKey', 'authkey');
update public.profiles set reminders = '{"enabled": true}' where user_id = 'eeeeeeee-aaaa-0000-0000-000000000001';

select results_eq(
  $$select kind, title, body from public.due_reminders('2026-11-24 07:05:00+00')$$,
  $$values ('habito'::text, 'Leer'::text, 'Toca ahora'::text)$$,
  'avisa del hábito con hora cuando llega su hora (08:05 en Madrid)');
select is((select count(*)::int from public.due_reminders('2026-11-24 06:55:00+00')), 0, 'no avisa antes de su hora');
select is((select count(*)::int from public.due_reminders('2026-11-24 07:30:00+00')), 0, 'no avisa pasada la ventana de 15 minutos');

insert into public.reminder_log (user_id, kind, ref, day) values ('eeeeeeee-aaaa-0000-0000-000000000001', 'habito', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-11-24');
select is((select count(*)::int from public.due_reminders('2026-11-24 07:05:00+00')), 0, 'no repite un aviso ya enviado');
delete from public.reminder_log;

insert into public.habit_logs (habit_id, user_id, date, value) values ('aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-aaaa-0000-0000-000000000001', '2026-11-24', 1);
select is((select count(*)::int from public.due_reminders('2026-11-24 07:05:00+00')), 0, 'no avisa de lo que ya está hecho');
delete from public.habit_logs;

insert into public.habit_skips (habit_id, user_id, date, reason) values ('aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-aaaa-0000-0000-000000000001', '2026-11-24', 'viaje');
select is((select count(*)::int from public.due_reminders('2026-11-24 07:05:00+00')), 0, 'no avisa de lo omitido');
delete from public.habit_skips;

insert into public.rest_days (user_id, date) values ('eeeeeeee-aaaa-0000-0000-000000000001', '2026-11-24');
select is((select count(*)::int from public.due_reminders('2026-11-24 07:05:00+00')), 0, 'un día de descanso lo excusa todo');
delete from public.rest_days;

-- Repaso de la tarde: 21:00 Madrid = 20:00 UTC. Pendientes hoy (martes): Leer y Agua (el de fin de semana no toca)
select results_eq(
  $$select kind, body from public.due_reminders('2026-11-24 20:03:00+00')$$,
  $$values ('repaso'::text, 'Te quedan 2 hábitos por hacer hoy'::text)$$,
  'el repaso cuenta solo lo que toca hoy y sigue pendiente');

insert into public.habit_logs (habit_id, user_id, date, value) values ('aaaaaaaa-0000-0000-0000-000000000002', 'eeeeeeee-aaaa-0000-0000-000000000001', '2026-11-24', 3);
select is((select body from public.due_reminders('2026-11-24 20:03:00+00')), 'Te quedan 2 hábitos por hacer hoy', 'una cantidad por debajo de la meta sigue pendiente');
update public.habit_logs set value = 8;
insert into public.habit_logs (habit_id, user_id, date, value) values ('aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-aaaa-0000-0000-000000000001', '2026-11-24', 1);
select is((select count(*)::int from public.due_reminders('2026-11-24 20:03:00+00')), 0, 'sin pendientes no hay repaso');
delete from public.habit_logs;

-- Revisión semanal: domingo 2026-11-29 a las 19:00 Madrid = 18:00 UTC
update public.profiles set reminders = '{"enabled": true, "evening": false, "habitTimes": false}' where user_id = 'eeeeeeee-aaaa-0000-0000-000000000001';
select results_eq(
  $$select kind, url from public.due_reminders('2026-11-29 18:02:00+00')$$,
  $$values ('revision'::text, '/revision'::text)$$,
  'el domingo a las 19:00 recuerda la revisión semanal');
insert into public.weekly_reviews (user_id, week_start, went_well) values ('eeeeeeee-aaaa-0000-0000-000000000001', '2026-11-23', 'ya hecha');
select is((select count(*)::int from public.due_reminders('2026-11-29 18:02:00+00')), 0, 'si ya hiciste la revisión no avisa');

-- Restricciones
set local session_replication_role = origin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-aaaa-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$update public.profiles set reminders = '{"eveningTime": "25:99"}'$$, '23514', null, 'rechaza una hora de repaso no válida');
select throws_ok($$insert into public.push_subscriptions (endpoint, p256dh, auth) values ('http://inseguro.test/x', 'k', 'a')$$, '23514', null, 'el endpoint debe ser https');

set local request.jwt.claims = '{"sub":"eeeeeeee-aaaa-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.push_subscriptions), 0, 'otro usuario no ve mis dispositivos');

select * from finish();
rollback;
