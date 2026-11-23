begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('eeeeeeee-9999-0000-0000-000000000001', 'l1@test.local', 'authenticated', 'authenticated'),
  ('eeeeeeee-9999-0000-0000-000000000002', 'l2@test.local', 'authenticated', 'authenticated');

select is((select today_layout from public.profiles where user_id = 'eeeeeeee-9999-0000-0000-000000000001'), '{}'::jsonb, 'por defecto el orden está vacío (la app usa el predeterminado)');

set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-9999-0000-0000-000000000001","role":"authenticated"}';

select lives_ok($$update public.profiles set today_layout = '{"order":["foco","habitos"],"hidden":["areas"]}' where user_id = 'eeeeeeee-9999-0000-0000-000000000001'$$, 'guarda su orden');
select is((select today_layout->'order'->>0 from public.profiles), 'foco', 'lo lee de vuelta');
select throws_ok($$update public.profiles set today_layout = '[1,2]' where user_id = 'eeeeeeee-9999-0000-0000-000000000001'$$, '23514', null, 'rechaza algo que no sea un objeto');
select throws_ok($$update public.profiles set today_layout = jsonb_build_object('x', repeat('a', 3000)) where user_id = 'eeeeeeee-9999-0000-0000-000000000001'$$, '23514', null, 'rechaza un objeto demasiado grande');

update public.profiles set today_layout = '{"order":["hackeado"]}' where user_id = 'eeeeeeee-9999-0000-0000-000000000002';
set local request.jwt.claims = '{"sub":"eeeeeeee-9999-0000-0000-000000000002","role":"authenticated"}';
select is((select today_layout from public.profiles), '{}'::jsonb, 'no puede cambiar el orden de otro usuario');
select is((select count(*)::int from public.profiles), 1, 'solo ve su perfil');

select * from finish();
rollback;
