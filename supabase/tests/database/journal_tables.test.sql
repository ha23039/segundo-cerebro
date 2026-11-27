begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, email, aud, role) values
  ('eeeeeeee-bbbb-0000-0000-000000000001', 't1@test.local', 'authenticated', 'authenticated'),
  ('eeeeeeee-bbbb-0000-0000-000000000002', 't2@test.local', 'authenticated', 'authenticated');

select ok((select relrowsecurity from pg_class where oid = 'public.journal_tables'::regclass), 'RLS en journal_tables');
select ok((select relrowsecurity from pg_class where oid = 'public.journal_columns'::regclass), 'RLS en journal_columns');
select ok((select relrowsecurity from pg_class where oid = 'public.journal_rows'::regclass), 'RLS en journal_rows');
select ok(not has_table_privilege('anon', 'public.journal_rows', 'select'), 'anon no lee filas');
select ok(not has_table_privilege('authenticated', 'public.journal_tables', 'delete'), 'las tablas no se borran de verdad (papelera)');
select ok(not has_function_privilege('anon', 'public.set_cell(uuid,uuid,jsonb)', 'execute'), 'anon no ejecuta set_cell');

set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-bbbb-0000-0000-000000000001","role":"authenticated"}';

insert into public.journal_tables (id, name) values ('b0000000-0000-0000-0000-000000000001', '  Trading  ');
select is((select name from public.journal_tables), 'Trading', 'recorta el nombre de la tabla');
select throws_ok($$insert into public.journal_tables (name) values ('  ')$$, '23514', null, 'rechaza una tabla sin nombre');

insert into public.journal_columns (id, table_id, name, type, position, options) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Activo', 'texto', 1, '{}'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Entrada', 'numero', 2, '{}'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Tipo', 'lista', 3, '{"choices":["Compra","Venta"]}'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Cerrada', 'casilla', 4, '{}'),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'Fecha', 'fecha', 5, '{}'),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'Notas', 'items', 6, '{}'),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'Doble', 'formula', 7, '{"formula":"{Entrada} * 2"}');

select throws_ok($$insert into public.journal_columns (table_id, name, type) values ('b0000000-0000-0000-0000-000000000001', ' ACTIVO ', 'texto')$$, '23505', null, 'el nombre de columna no se repite (sin mayúsculas ni espacios)');
select throws_ok($$insert into public.journal_columns (table_id, name, type) values ('b0000000-0000-0000-0000-000000000001', 'Con {llaves}', 'texto')$$, '23514', null, 'el nombre no lleva llaves');
select throws_ok($$insert into public.journal_columns (table_id, name, type) values ('b0000000-0000-0000-0000-000000000001', 'Rara', 'macro')$$, '23514', null, 'tipo de columna desconocido');
select throws_ok($$insert into public.journal_columns (table_id, name, type) values ('b0000000-0000-0000-0000-000000000001', 'SinFormula', 'formula')$$, '23514', null, 'una fórmula exige su texto');
select throws_ok($$insert into public.journal_columns (table_id, name, type, options) values ('b0000000-0000-0000-0000-000000000001', 'SinOpciones', 'lista', '{}')$$, '23514', null, 'una lista exige opciones');

insert into public.journal_rows (id, table_id) values ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');

select lives_ok($$select public.set_cell('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '"EURUSD"')$$, 'escribe texto');
select lives_ok($$select public.set_cell('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', '1.0825')$$, 'escribe un número');
select is((select cells ->> 'c0000000-0000-0000-0000-000000000001' from public.journal_rows), 'EURUSD', 'la celda de texto quedó guardada');
select is((select (cells -> 'c0000000-0000-0000-0000-000000000002')::numeric from public.journal_rows), 1.0825, 'la celda de número quedó guardada sin tocar las demás');

select throws_ok($$select public.set_cell('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', '"abc"')$$, '23514', null, 'rechaza texto en una columna numérica');
select throws_ok($$select public.set_cell('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', '"Otra"')$$, '23514', null, 'rechaza una opción que no está en la lista');
select throws_ok($$select public.set_cell('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', '"2026-02-30"')$$, '22008', null, 'rechaza una fecha imposible');
select throws_ok($$select public.set_cell('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', '[{"t":"a"}]')$$, '23514', null, 'rechaza un ítem sin estado');
select lives_ok($$select public.set_cell('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', '[{"t":"revisar","d":true}]')$$, 'acepta ítems bien formados');
select throws_ok($$select public.set_cell('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', '5')$$, '23514', null, 'no se escribe en una columna de fórmula');
select lives_ok($$select public.set_cell('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', null)$$, 'null vacía la celda');
select ok(not (select cells ? 'c0000000-0000-0000-0000-000000000001' from public.journal_rows), 'la celda vaciada desaparece');

-- Otro usuario no ve ni toca nada
set local request.jwt.claims = '{"sub":"eeeeeeee-bbbb-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.journal_rows), 0, 'otro usuario no ve filas ajenas');
select is((select count(*)::int from public.journal_tables), 0, 'otro usuario no ve tablas ajenas');
select throws_ok($$select public.set_cell('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '"x"')$$, 'P0002', null, 'otro usuario no puede escribir en una fila ajena');
select throws_ok($$insert into public.journal_rows (table_id) values ('b0000000-0000-0000-0000-000000000001')$$, '23503', null, 'no se crean filas en una tabla ajena');

select * from finish();
rollback;
