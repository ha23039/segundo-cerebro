begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

insert into auth.users (id, email, aud, role)
values ('cccccccc-2222-0000-0000-000000000001', 'sr@test.local', 'authenticated', 'authenticated');
insert into public.habits (id, user_id, name, kind, frequency, days)
values ('44444444-2222-0000-0000-000000000004', 'cccccccc-2222-0000-0000-000000000001', 'Leer', 'check', 'dias', '{1}');
insert into public.habit_schedules (habit_id, user_id, valid_from, frequency, days)
values ('44444444-2222-0000-0000-000000000004', 'cccccccc-2222-0000-0000-000000000001', current_date, 'dias', '{1}');

-- La secret key (scripts de administración, restauración) usa el rol service_role
set local role service_role;

select lives_ok(
  $$update public.habit_schedules set valid_from = current_date - 10
    where habit_id = '44444444-2222-0000-0000-000000000004'$$,
  'service_role puede modificar horarios (check con private.valid_frequency)'
);
select lives_ok(
  $$insert into public.habit_logs (habit_id, user_id, date, value)
    values ('44444444-2222-0000-0000-000000000004', 'cccccccc-2222-0000-0000-000000000001', current_date, 1)$$,
  'service_role puede insertar registros (trigger con private.user_today)'
);

select * from finish();
rollback;
