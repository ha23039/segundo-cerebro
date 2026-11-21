begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, aud, role)
values ('dddddddd-3333-0000-0000-000000000001', 'ar@test.local', 'authenticated', 'authenticated');
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-3333-0000-0000-000000000001","role":"authenticated"}';

insert into ids values ('a', public.create_habit('Correr', 'check', null, 'dias', '{1}', null, null, 'ejercicio'));
insert into ids values ('b', public.create_habit('Leer', 'check', null, 'dias', '{1}', null, null));

select is((select area from public.habits where id = (select id from ids where name = 'a')), 'ejercicio', 'create_habit guarda el área');
select is((select area from public.habits where id = (select id from ids where name = 'b')), 'desarrollo', 'área por defecto: desarrollo');

select public.update_habit((select id from ids where name = 'b'), 'Leer', null, 'dias', '{1}', null, null, 'estudio');
select is((select area from public.habits where id = (select id from ids where name = 'b')), 'estudio', 'update_habit cambia el área');
select is((select count(*)::int from public.habit_schedules where habit_id = (select id from ids where name = 'b')), 1, 'cambiar el área no abre un periodo nuevo');

select throws_ok(
  $$select public.create_habit('X', 'check', null, 'dias', '{1}', null, null, 'marte')$$,
  '23514', null, 'un área desconocida falla'
);

select * from finish();
rollback;
