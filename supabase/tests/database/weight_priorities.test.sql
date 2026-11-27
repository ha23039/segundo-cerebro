begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role) values
  ('eeeeeeee-4444-0000-0000-000000000001', 'wp@test.local', 'authenticated', 'authenticated'),
  ('eeeeeeee-4444-0000-0000-000000000002', 'wq@test.local', 'authenticated', 'authenticated');
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-4444-0000-0000-000000000001","role":"authenticated"}';

insert into ids values ('a', public.create_habit('Leer', 'check', null, 'dias', '{1}', null, null, 'estudio', 5::smallint));
insert into ids values ('b', public.create_habit('Agua', 'check', null, 'dias', '{1}', null, null));
select is((select weight from public.habits where id = (select id from ids where name = 'a')), 5::smallint, 'create_habit guarda el peso');
select is((select weight from public.habits where id = (select id from ids where name = 'b')), 3::smallint, 'peso por defecto 3');
select public.update_habit((select id from ids where name = 'b'), 'Agua', null, 'dias', '{1}', null, null, null, 1::smallint);
select is((select weight from public.habits where id = (select id from ids where name = 'b')), 1::smallint, 'update_habit cambia el peso');
select throws_ok($$select public.create_habit('X', 'check', null, 'dias', '{1}', null, null, null, 9::smallint)$$, '23514', null, 'peso fuera de 1..5 falla');

insert into public.daily_priorities (date, position, title) values
  (private.user_today(), 1, 'Cerrar el informe'), (private.user_today(), 2, 'Llamar a casa'), (private.user_today(), 3, 'Revisar gastos');
select throws_ok($$insert into public.daily_priorities (date, position, title) values (private.user_today(), 4, 'Cuarta')$$, '23514', null, 'máximo 3 prioridades por día');
select throws_ok($$insert into public.daily_priorities (date, position, title) values (private.user_today(), 1, 'Repetida')$$, '23505', null, 'una prioridad por posición');
select throws_ok($$insert into public.daily_priorities (date, position, title) values (private.user_today() + 1, 1, '   ')$$, '23514', null, 'título vacío falla');

set local request.jwt.claims = '{"sub":"eeeeeeee-4444-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.daily_priorities), 0, 'B no ve las prioridades de A');
update public.daily_priorities set done = true;
reset role;
select is((select count(*)::int from public.daily_priorities where done and user_id = 'eeeeeeee-4444-0000-0000-000000000001'), 0, 'B no puede marcar las de A');

select * from finish();
rollback;
