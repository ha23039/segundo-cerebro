begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role) values
  ('ffffffff-5555-0000-0000-000000000001', 'rs1@test.local', 'authenticated', 'authenticated'),
  ('ffffffff-5555-0000-0000-000000000002', 'rs2@test.local', 'authenticated', 'authenticated');
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

select ok((select relrowsecurity from pg_class where oid = 'public.rest_days'::regclass), 'RLS activo en rest_days');
select ok((select relrowsecurity from pg_class where oid = 'public.habit_skips'::regclass), 'RLS activo en habit_skips');
select ok(not has_table_privilege('anon', 'public.rest_days', 'select'), 'anon no lee rest_days');
select ok(not has_table_privilege('anon', 'public.habit_skips', 'select'), 'anon no lee habit_skips');

set local role authenticated;
set local request.jwt.claims = '{"sub":"ffffffff-5555-0000-0000-000000000001","role":"authenticated"}';

insert into ids values ('h', public.create_habit('Correr', 'check', null, 'dias', '{1,2,3,4,5,6,7}', null, null));

-- Descanso: hoy, planificado a futuro y corrigiendo el pasado reciente
select lives_ok($$insert into public.rest_days (date, note) values (private.user_today(), 'Domingo libre')$$, 'descanso hoy');
select lives_ok($$insert into public.rest_days (date) values (private.user_today() + 30)$$, 'descanso planificado a 30 días');
select throws_ok($$insert into public.rest_days (date) values (private.user_today() + 91)$$, '23514', null, 'no más de 90 días adelante');
select throws_ok($$insert into public.rest_days (date) values (private.user_today() - 8)$$, '23514', null, 'no más de 7 días atrás');
select throws_ok($$insert into public.rest_days (date) values (private.user_today())$$, '23505', null, 'un descanso por día');
select throws_ok($$insert into public.rest_days (date, note) values (private.user_today() + 1, '   ')$$, '23514', null, 'nota vacía falla');

-- Omisión justificada
select lives_ok(
  $$insert into public.habit_skips (habit_id, date, reason) values ((select id from ids where name = 'h'), private.user_today() - 1, 'enfermedad')$$,
  'omitir un hábito ayer'
);
select throws_ok(
  $$insert into public.habit_skips (habit_id, date, reason) values ((select id from ids where name = 'h'), private.user_today(), 'pereza')$$,
  '23514', null, 'motivo fuera de la lista falla'
);

-- Aislamiento entre usuarios
set local request.jwt.claims = '{"sub":"ffffffff-5555-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.rest_days), 0, 'B no ve los descansos de A');
select is((select count(*)::int from public.habit_skips), 0, 'B no ve las omisiones de A');
select throws_ok(
  $$insert into public.habit_skips (habit_id, date, reason) values ((select id from ids where name = 'h'), private.user_today(), 'viaje')$$,
  '23503', null, 'B no puede omitir un hábito de A'
);
delete from public.rest_days;
reset role;
select is(
  (select count(*)::int from public.rest_days where user_id = 'ffffffff-5555-0000-0000-000000000001'),
  2, 'B no puede borrar los descansos de A'
);

select * from finish();
rollback;
