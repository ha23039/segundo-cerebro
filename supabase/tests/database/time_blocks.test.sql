begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role) values
  ('eeeeeeee-5555-0000-0000-000000000001', 'tb@test.local', 'authenticated', 'authenticated');
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-5555-0000-0000-000000000001","role":"authenticated"}';

insert into ids values ('a', public.create_habit('Lectura', 'check', null, 'dias', '{1}', null, null, 'estudio', 3::smallint, '20:00', '20:30'));
insert into ids values ('b', public.create_habit('Agua', 'check', null, 'dias', '{1}', null, null));

select is(
  (select start_time::text || '-' || end_time::text from public.habits where id = (select id from ids where name = 'a')),
  '20:00:00-20:30:00', 'create_habit guarda el bloque horario'
);
select ok(
  (select start_time is null and end_time is null from public.habits where id = (select id from ids where name = 'b')),
  'sin horas, el bloque queda vacío'
);

-- Solo la hora de inicio es válida (sin fin)
select public.update_habit((select id from ids where name = 'b'), 'Agua', null, 'dias', '{1}', null, null, null, null, '22:30', null);
select is((select start_time::text from public.habits where id = (select id from ids where name = 'b')), '22:30:00', 'update_habit cambia la hora');
select ok((select end_time is null from public.habits where id = (select id from ids where name = 'b')), 'el fin puede quedar vacío');

-- Cambiar solo la hora no abre un periodo nuevo: no reescribe el historial
select is((select count(*)::int from public.habit_schedules where habit_id = (select id from ids where name = 'b')), 1, 'cambiar la hora no crea periodos');

-- Quitar el bloque
select public.update_habit((select id from ids where name = 'b'), 'Agua', null, 'dias', '{1}', null, null);
select ok((select start_time is null from public.habits where id = (select id from ids where name = 'b')), 'update_habit sin horas las quita');

-- Validaciones
select throws_ok(
  $$select public.create_habit('X', 'check', null, 'dias', '{1}', null, null, null, null, '20:00', '19:00')$$,
  '23514', null, 'el fin debe ser posterior al inicio'
);
select throws_ok(
  $$select public.create_habit('Y', 'check', null, 'dias', '{1}', null, null, null, null, null, '19:00')$$,
  '23514', null, 'no hay fin sin inicio'
);

select * from finish();
rollback;
