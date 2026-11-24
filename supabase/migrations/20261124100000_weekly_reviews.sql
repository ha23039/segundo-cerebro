-- Revisión semanal: una nota por semana (lunes a domingo) con lo que fue bien, lo que mejorar y el foco de la siguiente.
-- Las cifras de la semana no se guardan: se calculan siempre desde los registros.

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  went_well text not null default '',
  to_improve text not null default '',
  next_focus text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start),
  constraint weekly_reviews_monday_check check (extract(isodow from week_start) = 1),
  constraint weekly_reviews_went_well_check check (char_length(went_well) <= 1000),
  constraint weekly_reviews_to_improve_check check (char_length(to_improve) <= 1000),
  constraint weekly_reviews_next_focus_check check (char_length(next_focus) <= 500),
  constraint weekly_reviews_not_empty_check check (char_length(btrim(went_well || to_improve || next_focus)) >= 1)
);

-- La semana debe haber empezado ya (según la zona del perfil) y no cambia una vez creada.
create function private.weekly_reviews_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.week_start > private.user_today() then
    raise exception 'No se puede revisar una semana que aún no ha empezado' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.week_start <> old.week_start then
    raise exception 'La semana de una revisión no se cambia' using errcode = '23514';
  end if;
  new.went_well := btrim(new.went_well);
  new.to_improve := btrim(new.to_improve);
  new.next_focus := btrim(new.next_focus);
  new.updated_at := now();
  return new;
end;
$$;

create trigger weekly_reviews_before_write
  before insert or update on public.weekly_reviews
  for each row execute function private.weekly_reviews_before_write();

alter table public.weekly_reviews enable row level security;

revoke all on table public.weekly_reviews from anon, authenticated;
grant select, insert, update, delete on table public.weekly_reviews to authenticated;
grant select, insert, update, delete on table public.weekly_reviews to service_role;

create policy "weekly_reviews: ver las propias" on public.weekly_reviews
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "weekly_reviews: crear las propias" on public.weekly_reviews
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "weekly_reviews: editar las propias" on public.weekly_reviews
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "weekly_reviews: borrar las propias" on public.weekly_reviews
  for delete to authenticated using ((select auth.uid()) = user_id);
