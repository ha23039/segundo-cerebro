begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, aud, role) values
  ('eeeeeeee-6666-0000-0000-000000000001', 'g1@test.local', 'authenticated', 'authenticated'),
  ('eeeeeeee-6666-0000-0000-000000000002', 'g2@test.local', 'authenticated', 'authenticated');
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

select ok((select relrowsecurity from pg_class where oid = 'public.goals'::regclass), 'RLS activo en goals');
select ok((select relrowsecurity from pg_class where oid = 'public.milestones'::regclass), 'RLS activo en milestones');
select ok(not has_table_privilege('anon', 'public.goals', 'select'), 'anon no lee goals');
select ok(not has_table_privilege('anon', 'public.milestones', 'select'), 'anon no lee milestones');
select ok(not has_table_privilege('authenticated', 'public.goals', 'delete'), 'goals sin delete: el borrado es lógico');

set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-6666-0000-0000-000000000001","role":"authenticated"}';

with x as (
  insert into public.goals (title, due_date) values ('  Correr un 10K  ', private.user_today() + 30) returning id
)
insert into ids select 'g', id from x;
select is((select title from public.goals where id = (select id from ids where name = 'g')), '  Correr un 10K  ', 'crea un objetivo');
select is((select start_date from public.goals where id = (select id from ids where name = 'g')), private.user_today(), 'start_date por defecto es hoy');
select is((select status from public.goals where id = (select id from ids where name = 'g')), 'activo', 'nace activo');

select throws_ok($$insert into public.goals (title, due_date) values ('X', private.user_today() - 1)$$, '23514', null, 'la fecha límite no puede ser anterior al inicio');
select throws_ok($$insert into public.goals (title, due_date) values ('   ', private.user_today())$$, '23514', null, 'título vacío falla');
select throws_ok(
  $$update public.goals set status = 'completado' where id = (select id from ids where name = 'g')$$,
  '23514', null, 'completado exige completed_at'
);

-- Hitos: done_at lo pone la base de datos
insert into public.milestones (goal_id, title, position) values ((select id from ids where name = 'g'), 'Correr 5 km', 1);
select ok((select done_at is null from public.milestones limit 1), 'un hito nuevo no está hecho');
update public.milestones set done = true;
select ok((select done and done_at is not null from public.milestones limit 1), 'marcar hecho fija done_at');
update public.milestones set done = false;
select ok((select not done and done_at is null from public.milestones limit 1), 'desmarcar limpia done_at');

-- Un hábito solo se puede vincular a un objetivo propio
insert into ids values ('h', public.create_habit('Correr', 'check', null, 'dias', '{1}', null, null));
select lives_ok(
  $$update public.habits set goal_id = (select id from ids where name = 'g') where id = (select id from ids where name = 'h')$$,
  'vincula un hábito a su objetivo'
);

-- Aislamiento entre usuarios
set local request.jwt.claims = '{"sub":"eeeeeeee-6666-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.goals), 0, 'B no ve los objetivos de A');
select is((select count(*)::int from public.milestones), 0, 'B no ve los hitos de A');
select throws_ok(
  $$insert into public.milestones (goal_id, title) values ((select id from ids where name = 'g'), 'Intruso')$$,
  '23503', null, 'B no puede añadir hitos al objetivo de A'
);

-- Purgar el objetivo borra sus hitos y desvincula los hábitos (sin borrarlos)
reset role;
delete from public.goals;
select is((select count(*)::int from public.milestones), 0, 'purgar el objetivo borra sus hitos');
select ok((select goal_id is null from public.habits where id = (select id from ids where name = 'h')), 'el hábito queda desvinculado, no borrado');

select * from finish();
rollback;
