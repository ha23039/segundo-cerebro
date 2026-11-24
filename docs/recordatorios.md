# Recordatorios con notificaciones push

Avisos en el iPhone (y en Android o escritorio) aunque la app esté cerrada: a la hora de cada hábito, un repaso por la tarde y el recordatorio de la revisión semanal.

> **Qué necesita iPhone:** iOS 16.4 o posterior y la app **instalada en la pantalla de inicio** (Safari → Compartir → «Añadir a pantalla de inicio»). Desde una pestaña de Safari iOS no permite notificaciones. El permiso se pide al pulsar **Activar avisos** en Ajustes.

## Cómo funciona

1. En Ajustes, «Activar avisos» pide permiso, suscribe el dispositivo y guarda la suscripción (`push_subscriptions`, con RLS) y tus preferencias (`profiles.reminders`).
2. Cada minuto, `pg_cron` llama a la Edge Function `send-reminders`. Ella pregunta a la base de datos qué hay que avisar ahora (`public.due_reminders()`, comprobada con pgTAP) y envía cada aviso cifrado (Web Push, RFC 8291, firmado con VAPID, sin dependencias: `supabase/functions/_shared/webpush.ts`).
3. La base de datos decide, en tu zona horaria:
   - **Hábito con hora de inicio:** avisa entre su hora y 15 minutos después, solo si hoy toca, no está hecho, no está omitido y no es día de descanso. En un hábito de cantidad, «hecho» es llegar a la meta.
   - **Repaso de la tarde** (por defecto 21:00): «Te quedan N hábitos por hacer hoy». No se envía si no queda nada.
   - **Revisión semanal:** domingo a las 19:00 si aún no la hiciste.
4. Cada aviso se envía una vez al día (`reminder_log`, se purga a los 14 días). Un aviso tardío (fuera de la ventana de 15 minutos) se descarta: peor que ninguno.
5. Si el servicio de push responde 404 o 410 (dispositivo desinstalado), la suscripción se borra sola.

## Puesta en marcha (una vez, desde tu ordenador)

```bash
# 1. Claves VAPID: la privada NO va al repositorio
node scripts/vapid-keygen.mjs

# 2. Secretos de la función (usa la privada que acabas de generar)
npx supabase secrets set \
  VAPID_PUBLIC_KEY=<publica> VAPID_PRIVATE_KEY=<privada> \
  VAPID_SUBJECT=mailto:<tu-correo> CRON_SECRET=$(openssl rand -hex 32)

# 3. Publicar la función
npx supabase functions deploy send-reminders --no-verify-jwt
```

4. En el panel de Supabase → **Database → Extensions**, activa `pg_net`.
5. En el **SQL Editor**, guarda la URL y el secreto en Vault y programa la llamada (sustituye los valores; el secreto es el mismo `CRON_SECRET`):

```sql
select vault.create_secret('https://<REF>.supabase.co', 'project_url');
select vault.create_secret('<CRON_SECRET>', 'reminders_secret');

select cron.schedule('send-reminders', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object('x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_secret'))
  );
$$);
```

6. Compila la app con la clave **pública** (no es secreta, pero sin ella la app no ofrece los avisos). Añádela a `.env.production.local`:

```
VITE_VAPID_PUBLIC_KEY=<publica>
```

   y vuelve a hacer `npm run build && npx wrangler deploy`.
7. En el iPhone, con la app instalada: Ajustes → Recordatorios → **Activar avisos**.

## Comprobar que funciona

- Llamada manual (debe responder `{"due":N,"sent":N,"removed":0}`):

  ```bash
  curl -s -X POST -H "x-cron-secret: <CRON_SECRET>" https://<REF>.supabase.co/functions/v1/send-reminders
  ```
- Pon a un hábito de hoy una hora de inicio dentro de unos minutos y espera el aviso.
- Registros de la función: panel → **Edge Functions → send-reminders → Logs**. Calendario del cron: **Integrations → Cron**.

## Límites y honestidad

- El cifrado y la firma se prueban con vitest (el navegador simulado puede descifrar lo que se envía) y la lógica de «qué avisar» con pgTAP, pero **el envío real a Apple o Google solo se puede comprobar una vez desplegado**; no se ha podido probar desde el entorno de desarrollo.
- El cron de cada minuto son unas 43 000 llamadas al mes, muy por debajo del plan gratis de Supabase.
- `push_subscriptions` y `reminder_log` no entran en «Tus datos» (son tokens de dispositivo, no datos tuyos), pero sí en el respaldo cifrado.
- Para quitarlo todo: `select cron.unschedule('send-reminders');` y, en Ajustes, «Desactivar en este dispositivo».
