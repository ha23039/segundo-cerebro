begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, aud, role) values
  ('eeeeeeee-9999-0000-0000-000000000001', 'w1@test.local', 'authenticated', 'authenticated'),
  ('eeeeeeee-9999-0000-0000-000000000002', 'w2@test.local', 'authenticated', 'authenticated');

select ok((select relrowsecurity from pg_class where oid = 'public.weekly_reviews'::regclass), 'RLS activo en weekly_reviews');
select ok(not has_table_privilege('anon', 'public.weekly_reviews', 'select'), 'anon no lee revisiones');

set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-9999-0000-0000-000000000001","role":"authenticated"}';

select lives_ok($$insert into public.weekly_reviews (week_start, went_well) values (date_trunc('week', private.user_today())::date - 7, '  Entrené tres veces  ')$$, 'crea la revisión de la semana pasada');
select is((select went_well from public.weekly_reviews limit 1), 'Entrené tres veces', 'recorta espacios');
select throws_ok($$insert into public.weekly_reviews (week_start, to_improve) values (date_trunc('week', private.user_today())::date - 7, 'otra')$$, '23505', null, 'una sola revisión por semana');
select throws_ok($$insert into public.weekly_reviews (week_start, went_well) values (date_trunc('week', private.user_today())::date - 13, 'no es lunes')$$, '23514', null, 'la semana empieza en lunes');
select throws_ok($$insert into public.weekly_reviews (week_start) values (date_trunc('week', private.user_today())::date - 14)$$, '23514', null, 'no se guarda una revisión vacía');
select throws_ok($$insert into public.weekly_reviews (week_start, went_well) values (date_trunc('week', private.user_today())::date + 7, 'futuro')$$, '23514', null, 'no se revisa una semana futura');
select throws_ok($$insert into public.weekly_reviews (week_start, next_focus) values (date_trunc('week', private.user_today())::date - 21, repeat('x', 501))$$, '23514', null, 'el foco no pasa de 500 caracteres');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-9999-0000-0000-000000000002","role":"authenticated"}';

select is((select count(*)::int from public.weekly_reviews), 0, 'otro usuario no ve las revisiones ajenas');
select lives_ok($$delete from public.weekly_reviews$$, 'otro usuario puede intentar borrar, pero solo afecta a lo suyo');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-9999-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.weekly_reviews), 1, 'la revisión del primer usuario sigue ahí');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-9999-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$insert into public.weekly_reviews (user_id, week_start, went_well) values ('eeeeeeee-9999-0000-0000-000000000001', date_trunc('week', private.user_today())::date - 28, 'x')$$, '42501', null, 'no se crea a nombre de otro');

select * from finish();
rollback;
