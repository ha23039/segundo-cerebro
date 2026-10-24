-- Perfil del usuario (zona horaria) y utilidades privadas.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'Europe/Madrid',
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (timezone) on table public.profiles to authenticated;

create policy "profiles: ver el propio"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles: editar el propio"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Valida la zona horaria y mantiene updated_at
create function private.profiles_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Zona horaria no válida: %', new.timezone using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function private.profiles_before_write();

-- Alta automática del perfil. security definer: el trigger corre como el rol de auth.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- "Hoy" del usuario según la zona de su perfil.
create function private.user_today()
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select p.timezone from public.profiles p where p.user_id = (select auth.uid())),
    'Europe/Madrid'
  ))::date;
$$;

revoke execute on function private.user_today() from public, anon;
grant execute on function private.user_today() to authenticated;
