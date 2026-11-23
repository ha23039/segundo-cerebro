-- Orden y visibilidad de las tarjetas de Hoy, por usuario (viaja con la cuenta, no con el dispositivo).
-- Forma: {"order": ["resumen", ...], "hidden": ["areas", ...]}. La app descarta ids que no conoce y completa los que faltan,
-- así que la BD solo garantiza que sea un objeto pequeño.

alter table public.profiles
  add column today_layout jsonb not null default '{}'::jsonb,
  add constraint profiles_today_layout_check check (
    jsonb_typeof(today_layout) = 'object' and pg_column_size(today_layout) <= 2000
  );

grant update (today_layout) on table public.profiles to authenticated;
