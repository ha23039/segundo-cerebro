-- service_role (secret key: scripts de administración y restauración) también evalúa
-- los check y triggers que llaman a funciones de private.
grant usage on schema private to service_role;
grant execute on function private.valid_frequency(text, smallint[], smallint) to service_role;
grant execute on function private.normalize_days(smallint[]) to service_role;
grant execute on function private.user_today() to service_role;
