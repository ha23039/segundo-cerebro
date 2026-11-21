# Respaldo y restauración

Tres capas, de la más automática a la más manual:

1. **Respaldo semanal cifrado** (GitHub Actions -> Cloudflare R2): una copia cada domingo, las 12 últimas.
2. **Descargar mis datos** (Ajustes): JSON o CSV (zip) generados en tu dispositivo, cuando quieras.
3. **Informe imprimible** (Ajustes -> Informe imprimible): semana, mes o historial, para guardar como PDF.

> **Nunca subas al repo** claves, respaldos ni exportaciones. `.gitignore` y `npm run check:tracked` bloquean `*.age`, `*.key`, `backup-*` y `segundo-cerebro-AAAA-MM-DD.json|zip`.

## 1. Configurar el respaldo semanal (una sola vez, desde tu ordenador)

### a) Claves age

```bash
npm ci
node scripts/backup/keygen.mjs ~/segundo-cerebro-age.key
```

Imprime la **clave pública** (`age1…`) y guarda la **privada** en el archivo indicado (permisos 600). Guarda la privada en tu gestor de contraseñas y borra el archivo si quieres. **Sin la clave privada no se puede restaurar nada**; si la pierdes, los respaldos son ilegibles para siempre. El respaldo solo lleva la clave pública.

### b) Cloudflare R2

1. Panel de Cloudflare -> **R2** -> *Create bucket* (por ejemplo `segundo-cerebro-backups`), privado.
2. **R2 -> Manage API tokens -> Create API token**: permiso *Object Read & Write*, limitado a ese bucket. Anota *Access Key ID* y *Secret Access Key*.
3. Anota el endpoint S3: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

### c) Cadena de conexión de Supabase

En el panel de Supabase -> **Connect** -> *Session pooler* (compatible con IPv4, necesario en GitHub Actions). Copia la URI y sustituye `[YOUR-PASSWORD]` por la contraseña de la base de datos. Si la contraseña tiene caracteres especiales, codifícala (percent-encoding).

### d) Secretos en GitHub

Repositorio -> **Settings -> Secrets and variables -> Actions -> New repository secret**:

| Secreto | Valor |
|---|---|
| `SUPABASE_DB_URL` | La URI del paso c |
| `AGE_RECIPIENT` | La clave pública `age1…` del paso a |
| `R2_ENDPOINT` | El endpoint del paso b |
| `R2_BUCKET` | El nombre del bucket |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Las del token del paso b |

### e) Primera ejecución

**Actions -> Respaldo semanal -> Run workflow**. Debe acabar en verde y aparecer `backup-AAAA-MM-DD.tar.gz.age` en el bucket. Si falta un secreto, el primer paso lo dice por su nombre. Si el respaldo falla un domingo, GitHub te avisa por correo.

El respaldo guarda `schema.sql` y `data.sql` del esquema `public` (todas las tablas de la app: hábitos, registros, descansos, omisiones, prioridades, objetivos, hitos, foco, diario y notas, también lo archivado y la papelera). No guarda sesiones ni contraseñas de `auth`.

## 2. Restaurar (probado contra Supabase local)

Necesitas `psql` (macOS: `brew install libpq`), la clave privada y el archivo descargado del bucket.

1. **Base de datos vacía con el esquema.** En un proyecto nuevo: `npx supabase link --project-ref <REF>` y `npx supabase db push`.
2. **Primera pasada para conocer el id de tu cuenta** (fallará con un aviso, sin tocar nada):

   ```bash
   node scripts/backup/restore.mjs backup-AAAA-MM-DD.tar.gz.age ~/segundo-cerebro-age.key "<DB_URL>" --si-es-produccion
   ```

   El aviso incluye el `id` que falta en `auth.users`.
3. **Crear la cuenta con ese mismo id**:

   ```bash
   USER_ID=<id> SUPABASE_URL=https://<REF>.supabase.co SUPABASE_SECRET_KEY=<secret key> node scripts/create-user.mjs
   ```

4. **Restaurar** (repite el comando del paso 2). El script se niega a continuar si hay datos en las tablas, si la clave no es la correcta o si el destino no es local sin `--si-es-produccion`, y aplica todo en una sola transacción: o entra todo o no entra nada. Al terminar muestra las filas por tabla.

Para probarlo en local sin riesgo, usa una base de pruebas vacía y `PSQL="docker exec -i supabase_db_segundo-cerebro psql"` con una URL de puerto 5432 si no tienes `psql` en el ordenador.

### Descifrar a mano (opcional)

Con la herramienta [`age`](https://github.com/FiloSottile/age) instalada: `age -d -i ~/segundo-cerebro-age.key backup-AAAA-MM-DD.tar.gz.age > backup.tar.gz`.

## 3. Descargar mis datos y el informe

En **Ajustes -> Tus datos**: *Descargar JSON* (todo en un archivo, con versión y fecha) o *Descargar CSV (zip)* (un CSV por tabla, UTF-8, textos que empiezan por `=`, `+`, `-` o `@` protegidos contra fórmulas de hoja de cálculo). Se generan en el dispositivo y no pasan por ningún tercero. **Solo se exportan: la app no importa.**

*Informe imprimible* abre una hoja con el periodo elegido (cumplimiento total y por hábito, rachas, foco, diario y objetivos activos). El botón *Imprimir o guardar como PDF* usa la impresión del navegador, que siempre sale en blanco y negro sobre fondo claro. En iPhone: Imprimir, abre la vista previa con un pellizco hacia fuera, Compartir, Guardar en Archivos.
