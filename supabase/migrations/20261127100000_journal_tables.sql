-- Tablas tipo hoja de cálculo para journals (trading, gastos, gimnasio…): tablas con columnas personalizadas y filas.
-- Las celdas viven en un jsonb por fila ({id de columna: valor}) y se cambian de una en una con set_cell().
-- Las fórmulas se guardan como texto en la columna y se calculan en la app; la BD nunca las ejecuta.

create table public.journal_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint journal_tables_name_check check (char_length(btrim(name)) between 1 and 60)
);

create index journal_tables_user_idx on public.journal_tables (user_id, position) where deleted_at is null;

create table public.journal_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  table_id uuid not null,
  name text not null,
  type text not null,
  options jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (table_id, user_id) references public.journal_tables (id, user_id) on delete cascade,
  constraint journal_columns_name_check check (char_length(btrim(name)) between 1 and 40 and name !~ '[{}]'),
  constraint journal_columns_type_check check (type in ('texto', 'numero', 'fecha', 'lista', 'casilla', 'items', 'formula')),
  constraint journal_columns_options_check check (
    jsonb_typeof(options) = 'object'
    and pg_column_size(options) <= 2000
    -- coalesce: un check con NULL se da por bueno, y aquí la ausencia de la opción debe rechazarse
    and (type <> 'formula' or coalesce(jsonb_typeof(options -> 'formula') = 'string' and char_length(options ->> 'formula') between 1 and 200, false))
    and (type <> 'lista' or coalesce(jsonb_typeof(options -> 'choices') = 'array' and jsonb_array_length(options -> 'choices') between 1 and 30, false))
  )
);

-- Los nombres no se repiten en una tabla (las fórmulas las citan por nombre)
create unique index journal_columns_name_idx on public.journal_columns (table_id, lower(btrim(name)));
create index journal_columns_table_idx on public.journal_columns (table_id, position);

create table public.journal_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  table_id uuid not null,
  cells jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (table_id, user_id) references public.journal_tables (id, user_id) on delete cascade,
  constraint journal_rows_cells_check check (jsonb_typeof(cells) = 'object' and pg_column_size(cells) <= 20000)
);

create index journal_rows_table_idx on public.journal_rows (table_id, created_at, id);

-- ---------- Límites ----------

create function private.journal_tables_limits()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'journal_tables' then
    if (select count(*) from public.journal_tables t where t.user_id = new.user_id and t.deleted_at is null) >= 30 then
      raise exception 'Máximo 30 tablas' using errcode = '23514';
    end if;
    new.name := btrim(new.name);
  elsif tg_table_name = 'journal_columns' then
    if (select count(*) from public.journal_columns c where c.table_id = new.table_id) >= 30 then
      raise exception 'Máximo 30 columnas por tabla' using errcode = '23514';
    end if;
    new.name := btrim(new.name);
  else
    if (select count(*) from public.journal_rows r where r.table_id = new.table_id) >= 5000 then
      raise exception 'Máximo 5000 filas por tabla' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger journal_tables_limits before insert on public.journal_tables
  for each row execute function private.journal_tables_limits();
create trigger journal_columns_limits before insert on public.journal_columns
  for each row execute function private.journal_tables_limits();
create trigger journal_rows_limits before insert on public.journal_rows
  for each row execute function private.journal_tables_limits();

-- ---------- Cambiar una celda ----------
-- Una celda cada vez, de forma atómica: dos dispositivos editando celdas distintas no se pisan.
-- Valida el valor según el tipo de la columna. `null` vacía la celda.

create function public.set_cell(p_row uuid, p_column uuid, p_value jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c public.journal_columns%rowtype;
  r public.journal_rows%rowtype;
  item jsonb;
begin
  select * into r from public.journal_rows where id = p_row;
  if not found then raise exception 'La fila no existe' using errcode = 'P0002'; end if;
  select * into c from public.journal_columns where id = p_column and table_id = r.table_id;
  if not found then raise exception 'La columna no existe' using errcode = 'P0002'; end if;

  if p_value is not null and jsonb_typeof(p_value) <> 'null' then
    case c.type
      when 'texto' then
        if jsonb_typeof(p_value) <> 'string' or char_length(p_value #>> '{}') > 500 then
          raise exception 'Texto no válido' using errcode = '23514';
        end if;
      when 'numero' then
        if jsonb_typeof(p_value) <> 'number' or abs((p_value #>> '{}')::numeric) > 1e12 then
          raise exception 'Número no válido' using errcode = '23514';
        end if;
      when 'fecha' then
        if jsonb_typeof(p_value) <> 'string' or (p_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'Fecha no válida' using errcode = '23514';
        end if;
        perform (p_value #>> '{}')::date; -- falla con fechas imposibles
      when 'lista' then
        if jsonb_typeof(p_value) <> 'string' or not (c.options -> 'choices') ? (p_value #>> '{}') then
          raise exception 'Opción no válida' using errcode = '23514';
        end if;
      when 'casilla' then
        if p_value <> 'true'::jsonb then
          raise exception 'Casilla no válida' using errcode = '23514';
        end if;
      when 'items' then
        if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 50 then
          raise exception 'Lista no válida' using errcode = '23514';
        end if;
        for item in select * from jsonb_array_elements(p_value) loop
          if jsonb_typeof(item) is distinct from 'object'
             or jsonb_typeof(item -> 't') is distinct from 'string'
             or char_length(coalesce(item ->> 't', '')) not between 1 and 100
             or jsonb_typeof(item -> 'd') is distinct from 'boolean' then
            raise exception 'Ítem no válido' using errcode = '23514';
          end if;
        end loop;
      else
        raise exception 'Esa columna se calcula sola' using errcode = '23514';
    end case;
  end if;

  update public.journal_rows
  set cells = case
        when p_value is null or jsonb_typeof(p_value) = 'null' then cells - (p_column::text)
        else jsonb_set(cells, array[p_column::text], p_value, true)
      end,
      updated_at = now()
  where id = p_row;
end;
$$;

revoke execute on function public.set_cell(uuid, uuid, jsonb) from public, anon;
grant execute on function public.set_cell(uuid, uuid, jsonb) to authenticated;

-- ---------- RLS y permisos ----------

alter table public.journal_tables enable row level security;
alter table public.journal_columns enable row level security;
alter table public.journal_rows enable row level security;

revoke all on table public.journal_tables, public.journal_columns, public.journal_rows from anon, authenticated;
-- tablas sin delete: borrado lógico (deleted_at) y purga con pg_cron
grant select, insert, update on table public.journal_tables to authenticated;
grant select, insert, update, delete on table public.journal_columns, public.journal_rows to authenticated;
grant select, insert, update, delete on table public.journal_tables, public.journal_columns, public.journal_rows to service_role;

create policy "journal_tables: ver las propias" on public.journal_tables
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "journal_tables: crear las propias" on public.journal_tables
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "journal_tables: editar las propias" on public.journal_tables
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "journal_columns: ver las propias" on public.journal_columns
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "journal_columns: crear las propias" on public.journal_columns
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "journal_columns: editar las propias" on public.journal_columns
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "journal_columns: borrar las propias" on public.journal_columns
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "journal_rows: ver las propias" on public.journal_rows
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "journal_rows: crear las propias" on public.journal_rows
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "journal_rows: editar las propias" on public.journal_rows
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "journal_rows: borrar las propias" on public.journal_rows
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Papelera de tablas: purga diaria a las 03:55 UTC (borra también sus columnas y filas)
select cron.schedule(
  'purge-journal-tables-trash',
  '55 3 * * *',
  $$delete from public.journal_tables where deleted_at < now() - interval '30 days'$$
);
