begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-1111-0000-0000-000000000001', 'ra@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-1111-0000-0000-000000000002', 'rb@test.local', 'authenticated', 'authenticated');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-0000-0000-000000000001","role":"authenticated"}';

insert into ids values ('leer', public.create_habit('  Leer  ', 'check', null, 'dias', '{5,1,3}', null, null));
insert into ids values ('agua', public.create_habit('Agua', 'cantidad', 'vasos', 'semanal', null, 5::smallint, 8));

select results_eq(
  $$select valid_from, valid_to from public.habit_schedules where habit_id = (select id from ids where name = 'leer')$$,
  $$values (private.user_today(), null::date)$$,
  'create_habit abre un periodo desde hoy'
);
select results_eq(
  $$select name, days, position from public.habits where id = (select id from ids where name = 'leer')$$,
  $$values ('Leer', '{1,3,5}'::smallint[], 1)$$,
  'create_habit recorta el nombre, ordena los días y asigna posición'
);
select is(
  (select position from public.habits where id = (select id from ids where name = 'agua')),
  2,
  'el segundo hábito va después'
);
select throws_ok(
  $$select public.create_habit('Pasos', 'cantidad', 'pasos', 'dias', '{1}', null, null)$$,
  '23514', null,
  'hábito de cantidad sin meta falla'
);

-- Editar el mismo día que se creó: el periodo se actualiza en su sitio
select public.update_habit((select id from ids where name = 'leer'), 'Leer', null, 'dias', '{1,2,3,4,5}', null, null);
select results_eq(
  $$select count(*)::int, max(days) from public.habit_schedules where habit_id = (select id from ids where name = 'leer')$$,
  $$values (1, '{1,2,3,4,5}'::smallint[])$$,
  'editar el día de creación actualiza el periodo existente'
);

-- Hábito con un periodo que empezó hace 10 días
insert into public.habits (id, name, kind, frequency, days)
values ('33333333-1111-0000-0000-000000000003', 'Correr', 'check', 'dias', '{1,3,5}');
insert into public.habit_schedules (habit_id, valid_from, frequency, days)
values ('33333333-1111-0000-0000-000000000003', private.user_today() - 10, 'dias', '{1,3,5}');

select public.update_habit('33333333-1111-0000-0000-000000000003', 'Correr', null, 'dias', '{2,4}', null, null);
select results_eq(
  $$select valid_from, valid_to, days from public.habit_schedules
    where habit_id = '33333333-1111-0000-0000-000000000003' order by valid_from$$,
  $$values (private.user_today() - 10, private.user_today() - 1, '{1,3,5}'::smallint[]),
           (private.user_today(), null::date, '{2,4}'::smallint[])$$,
  'editar la frecuencia cierra el periodo antiguo y abre uno desde hoy'
);

select public.update_habit('33333333-1111-0000-0000-000000000003', 'Correr 5 km', null, 'dias', '{2,4}', null, null);
select results_eq(
  $$select (select count(*)::int from public.habit_schedules where habit_id = '33333333-1111-0000-0000-000000000003'),
           (select name from public.habits where id = '33333333-1111-0000-0000-000000000003')$$,
  $$values (2, 'Correr 5 km')$$,
  'cambiar solo el nombre no abre periodo nuevo'
);

-- Archivar y desarchivar el mismo día de la creación
select public.archive_habit((select id from ids where name = 'leer'));
select ok(
  (select archived_at is not null from public.habits where id = (select id from ids where name = 'leer')),
  'archive_habit marca archived_at'
);
select public.unarchive_habit((select id from ids where name = 'leer'));
select results_eq(
  $$select valid_from, valid_to, days from public.habit_schedules where habit_id = (select id from ids where name = 'leer')$$,
  $$values (private.user_today(), null::date, '{1,2,3,4,5}'::smallint[])$$,
  'archivar y desarchivar el mismo día deja un periodo desde hoy con la plantilla'
);

-- Archivar un hábito con historia: conserva el periodo antiguo
select public.archive_habit('33333333-1111-0000-0000-000000000003');
select results_eq(
  $$select valid_from, valid_to from public.habit_schedules
    where habit_id = '33333333-1111-0000-0000-000000000003' order by valid_from$$,
  $$values (private.user_today() - 10, private.user_today() - 1)$$,
  'archivar borra el periodo de hoy y conserva la historia'
);
select throws_ok(
  $$select public.update_habit('33333333-1111-0000-0000-000000000003', 'Correr', null, 'dias', '{1}', null, null)$$,
  '22023', null,
  'no se edita la frecuencia de un hábito archivado'
);

-- Orden
select public.move_habit((select id from ids where name = 'agua'), 'up');
select ok(
  (select position from public.habits where id = (select id from ids where name = 'agua'))
    < (select position from public.habits where id = (select id from ids where name = 'leer')),
  'move_habit sube el hábito por encima del anterior'
);
select lives_ok(
  $$select public.move_habit((select id from ids where name = 'agua'), 'up')$$,
  'subir el primero no falla'
);

-- Usuario B
set local request.jwt.claims = '{"sub":"bbbbbbbb-1111-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$select public.update_habit((select id from ids where name = 'leer'), 'Hackeado', null, 'dias', '{1}', null, null)$$,
  'P0002', null,
  'B no puede editar el hábito de A'
);

reset role;
select is(
  (select name from public.habits where id = (select id from ids where name = 'leer')),
  'Leer',
  'el hábito de A no cambió'
);
select ok(
  not has_function_privilege('anon', 'public.create_habit(text, text, text, text, smallint[], smallint, numeric)', 'execute'),
  'anon no puede ejecutar las RPC'
);

select * from finish();
rollback;
