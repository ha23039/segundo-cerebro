begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, aud, role) values
  ('eeeeeeee-8888-0000-0000-000000000001', 'j1@test.local', 'authenticated', 'authenticated'),
  ('eeeeeeee-8888-0000-0000-000000000002', 'j2@test.local', 'authenticated', 'authenticated');

select ok((select relrowsecurity from pg_class where oid = 'public.journal_entries'::regclass), 'RLS activo en journal_entries');
select ok((select relrowsecurity from pg_class where oid = 'public.notes'::regclass), 'RLS activo en notes');
select ok(not has_table_privilege('anon', 'public.notes', 'select'), 'anon no lee notas');
select ok(not has_table_privilege('authenticated', 'public.notes', 'delete'), 'las notas no se borran de verdad (papelera)');

set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-8888-0000-0000-000000000001","role":"authenticated"}';

-- Diario
select lives_ok($$insert into public.journal_entries (entry_date, body) values (private.user_today(), '  Buen día  ')$$, 'crea la entrada de hoy');
select is((select body from public.journal_entries where entry_date = private.user_today()), 'Buen día', 'recorta espacios del texto');
select throws_ok($$insert into public.journal_entries (entry_date, body) values (private.user_today(), 'otra')$$, '23505', null, 'una sola entrada por fecha');
select throws_ok($$insert into public.journal_entries (entry_date, body) values (private.user_today() - 1, '   ')$$, '23514', null, 'rechaza texto vacío');
select throws_ok($$insert into public.journal_entries (entry_date, body) values (private.user_today() - 2, repeat('x', 2001))$$, '23514', null, 'rechaza más de 2000 caracteres');
select throws_ok($$insert into public.journal_entries (entry_date, body) values (private.user_today() + 1, 'mañana')$$, '23514', null, 'rechaza días futuros');
select lives_ok($$insert into public.journal_entries (entry_date, body) values (private.user_today() - 30, 'hace un mes')$$, 'permite escribir días pasados sin límite');
select throws_ok($$update public.journal_entries set entry_date = private.user_today() - 5 where entry_date = private.user_today()$$, '23514', null, 'la fecha no se cambia');

-- Notas
select lives_ok($$insert into public.notes (title, body, tags) values ('Ideas del proyecto', 'Escribir **tests** primero', array['  Trabajo ', 'trabajo', 'IDEAS', ''])$$, 'crea una nota');
select is((select tags from public.notes where title = 'Ideas del proyecto'), array['trabajo', 'ideas'], 'normaliza etiquetas: minúsculas, sin repetidas ni vacías');
select throws_ok($$insert into public.notes (title, tags) values ('x', array[repeat('a', 31)])$$, '23514', null, 'etiqueta de más de 30 caracteres');
select throws_ok($$insert into public.notes (title) values ('   ')$$, '23514', null, 'título vacío');
select is(
  (select count(*)::int from public.notes where search @@ websearch_to_tsquery('spanish', 'escribiendo primeros')),
  1, 'búsqueda de texto completo en español con raíces (escribiendo/escribir)'
);

set local request.jwt.claims = '{"sub":"eeeeeeee-8888-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.notes), 0, 'otro usuario no ve mis notas');
select is((select count(*)::int from public.journal_entries), 0, 'otro usuario no ve mi diario');
select throws_ok($$insert into public.notes (user_id, title) values ('eeeeeeee-8888-0000-0000-000000000001', 'ajena')$$, '42501', null, 'no se puede crear una nota a nombre de otro');

select * from finish();
rollback;
