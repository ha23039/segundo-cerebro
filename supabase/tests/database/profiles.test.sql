begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Dos usuarios de prueba
insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

select is(
  (select count(*)::int from public.profiles),
  2,
  'cada usuario nuevo recibe un perfil'
);
select is(
  (select timezone from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  'Europe/Madrid',
  'zona horaria por defecto Europe/Madrid'
);

-- Como usuario A
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'A solo ve su perfil');

update public.profiles set timezone = 'Europe/Lisbon' where user_id = '22222222-2222-2222-2222-222222222222';
reset role;
select is(
  (select timezone from public.profiles where user_id = '22222222-2222-2222-2222-222222222222'),
  'Europe/Madrid',
  'A no puede modificar el perfil de B'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select throws_ok(
  $$update public.profiles set timezone = 'Marte/Olympus' where user_id = '11111111-1111-1111-1111-111111111111'$$,
  '22023',
  null,
  'rechaza zonas horarias inválidas'
);

select throws_ok(
  $$insert into public.profiles (user_id) values ('11111111-1111-1111-1111-111111111111')$$,
  '42501',
  null,
  'authenticated no puede insertar perfiles'
);

select is(private.user_today(), (now() at time zone 'Europe/Madrid')::date, 'user_today usa la zona del perfil');

select * from finish();
rollback;
