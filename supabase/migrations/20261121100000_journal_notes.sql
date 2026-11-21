-- Diario (una entrada por fecha) y notas (Markdown con etiquetas y búsqueda de texto completo).
-- El Markdown se guarda tal cual; la app lo sanitiza al mostrarlo. El texto del usuario nunca se ejecuta.

-- ---------- Diario ----------

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date),
  constraint journal_body_check check (char_length(btrim(body)) between 1 and 2000)
);

-- No se escribe sobre días futuros (según la zona del perfil); el pasado se puede editar sin límite.
create function private.journal_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.entry_date > private.user_today() then
    raise exception 'No se puede escribir en el diario de un día futuro' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.entry_date <> old.entry_date then
    raise exception 'La fecha de una entrada no se cambia' using errcode = '23514';
  end if;
  new.body := btrim(new.body);
  new.updated_at := now();
  return new;
end;
$$;

create trigger journal_before_write
  before insert or update on public.journal_entries
  for each row execute function private.journal_before_write();

-- ---------- Notas ----------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Búsqueda de texto completo en español sobre título y cuerpo
  search tsvector generated always as (
    to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored,
  constraint notes_title_check check (char_length(btrim(title)) between 1 and 120),
  constraint notes_body_check check (char_length(body) <= 20000),
  constraint notes_tags_check check (cardinality(tags) <= 10)
);

create index notes_user_idx on public.notes (user_id, pinned desc, updated_at desc) where deleted_at is null;
create index notes_search_idx on public.notes using gin (search);
create index notes_tags_idx on public.notes using gin (tags);

-- Normaliza etiquetas (minúsculas, sin espacios sobrantes, sin repetidas ni vacías, hasta 30 caracteres)
create function private.notes_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t text;
  clean text[] := '{}';
begin
  foreach t in array new.tags loop
    t := lower(btrim(t));
    if t <> '' then
      if char_length(t) > 30 then
        raise exception 'Una etiqueta no puede pasar de 30 caracteres' using errcode = '23514';
      end if;
      if not (t = any (clean)) then
        clean := clean || t;
      end if;
    end if;
  end loop;
  new.tags := clean;
  new.title := btrim(new.title);
  new.updated_at := now();
  return new;
end;
$$;

create trigger notes_before_write
  before insert or update on public.notes
  for each row execute function private.notes_before_write();

-- ---------- RLS y permisos ----------

alter table public.journal_entries enable row level security;
alter table public.notes enable row level security;

revoke all on table public.journal_entries, public.notes from anon, authenticated;
grant select, insert, update, delete on table public.journal_entries to authenticated;
-- notes sin delete: el borrado es lógico (deleted_at) y la purga la hace pg_cron
grant select, insert, update on table public.notes to authenticated;
grant select, insert, update, delete on table public.journal_entries, public.notes to service_role;

create policy "journal_entries: ver las propias" on public.journal_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "journal_entries: crear las propias" on public.journal_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "journal_entries: editar las propias" on public.journal_entries
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "journal_entries: borrar las propias" on public.journal_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "notes: ver las propias" on public.notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notes: crear las propias" on public.notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notes: editar las propias" on public.notes
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- Papelera de notas: purga diaria a las 03:40 UTC ----------

select cron.schedule(
  'purge-notes-trash',
  '40 3 * * *',
  $$delete from public.notes where deleted_at < now() - interval '30 days'$$
);
