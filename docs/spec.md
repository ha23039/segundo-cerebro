# Segundo Cerebro — Spec v1

App personal de hábitos y disciplina diaria. Un solo usuario, uso diario durante años, principalmente en iPhone como PWA. Prioridad: **registrar fácil, estadísticas claras, medir el progreso**. Nada decorativo.

## Decisiones tomadas
- **Stack:** Vite + React + TypeScript · Supabase (Auth + Postgres) con Supabase CLI: migraciones SQL en el repo, RLS en las migraciones, tipos con `supabase gen types` · PWA (manifest + service worker) · Vitest, Playwright, axe · GitHub (`ha23039/segundo-cerebro`, **público**: nunca se suben claves ni respaldos).
- **Infra:** desarrollo con Supabase local (Docker); producción en Supabase Cloud (plan gratis) y frontend estático en **Cloudflare** (Pages/Workers static assets). GitHub Actions: lint + tipos + Vitest + Playwright + axe → despliegue solo si todo pasa. Secretos en GitHub Secrets y `.env` local ignorado.
- **Auth:** correo + contraseña. Registros públicos **desactivados**; la única cuenta se crea desde CLI/panel.
- **Conexión:** la app abre sin red (shell en caché) y muestra un aviso; **registrar requiere red**. Cola sin conexión queda fuera de v1. *(Decisión de Claude)* Sin red se muestran en solo lectura los últimos datos cargados (caché de consultas guardada en IndexedDB), que se borra al cerrar sesión.
- **Diseño:** `tokens.css` y `theme.js` tal cual (`theme.js` en `<head>` antes del CSS). Se añade `--danger` (por paleta y modo) en un archivo aparte. Todo CSS usa variables, sin colores literales en componentes. Móvil primero, safe-area, objetivos táctiles ≥ 40 px, inputs de 16 px. Interfaz solo en español.
- **Fechas:** zona horaria guardada en el perfil (por defecto `Europe/Madrid`). Un "día" es la fecha local en esa zona. Semana de lunes a domingo. Madrid tiene horario de verano: los cálculos de fechas usan una librería con zonas horarias (nunca sumar 24 h) y hay tests para los días de cambio de hora (último domingo de marzo y de octubre).

## Modelo de datos (todas las tablas con `user_id` y RLS `user_id = auth.uid()`)
- `profiles`: zona horaria.
- `habits`: nombre, tipo (`check` | `cantidad` con unidad), orden, `goal_id` opcional, `deleted_at`.
- `habit_schedules` *(decisión de Claude: el historial no se reescribe)*: hábito, vigente desde, vigente hasta (null = actual), frecuencia (`dias` con días de la semana | `semanal` con N veces), meta (si es `cantidad`). Editar la frecuencia o la meta cierra el periodo actual y abre uno nuevo desde hoy. Archivar cierra el periodo; desarchivar abre uno nuevo. Así, los días pasados se miden siempre con la configuración que tenían.
- `habit_logs`: hábito, fecha, valor (1 para check; cantidad para cantidad). Único por (hábito, fecha).
- `focus_sessions`: inicio, fin, minutos planificados, minutos reales, tipo (foco | descanso), hábito u objetivo opcional.
- `goals`: título, descripción, fecha límite, estado (activo | completado | abandonado), `deleted_at`. `milestones`: objetivo, título, hecho, `done_at`, orden.
- `journal_entries`: fecha (única por usuario), texto ≤ 2000 caracteres.
- `notes`: título, cuerpo en Markdown, etiquetas (`text[]`), búsqueda de texto completo en español, `deleted_at`.
- Validación en el cliente y restricciones en la BD (longitudes, `check`, valores > 0).

## Reglas de cálculo
- **Programado:** un día está programado si cae dentro de un periodo de `habit_schedules` y, en `dias`, es uno de sus días de la semana. Un hábito `semanal` se mide por semana. El tipo (`check` / `cantidad`) no se puede cambiar después de crear el hábito.
- **Hecho:** `check` → hay registro; `cantidad` → valor ≥ meta.
- **Racha (`dias`):** días programados consecutivos hechos. Los días no programados no la rompen; hoy pendiente no la rompe hasta que termina el día. **Racha (`semanal`):** semanas consecutivas con ≥ N; la semana en curso no la rompe.
- **Semanas parciales (`semanal`)** *(decisión de Claude)*: la semana en que empieza o termina un periodo de horario (crear, editar, archivar), no cuenta para el cumplimiento y no rompe la racha. Si en esa semana llega a N, sí suma a la racha.
- **Cumplimiento:** hechos ÷ programados en el periodo (`semanal`: min(hechos, N) ÷ N por semana). El total de un periodo suma los hechos y los programados de todos los hábitos (cada vez de un `semanal` cuenta como una unidad); no promedia los porcentajes. Sin nada programado se muestra "—", no 0 %.
- **Corrección** *(decisión de Claude)*: el límite de hoy y hasta 7 días atrás aplica **solo a los registros de hábitos** y se valida también en la BD. El diario se puede editar sin límite. Las sesiones de foco solo se crean con el temporizador y se pueden borrar, no editar. `done_at` de un hito es el momento en que se marca.
- **Papelera:** borrar marca `deleted_at`; se puede restaurar 30 días y luego se purga (`pg_cron`).

## Historias y criterios de aceptación
**H1 Hábitos.** Como usuario creo, edito, ordeno, archivo y borro hábitos.
- Crear valida nombre (1–80) y frecuencia (al menos 1 día o N entre 1 y 7). Archivar lo quita de Hoy y conserva el historial.

**H2 Hoy.** Abro la app y veo lo que toca hoy y lo marco con un toque.
- Muestra los hábitos `dias` programados hoy y los `semanal` aún sin cumplir esta semana. `check` se marca o desmarca con un toque; `cantidad` usa +/− o escribir el valor. Persiste tras recargar.
- También muestra la racha de cada hábito, los minutos de foco de hoy, los objetivos que vencen en ≤ 7 días y un acceso al diario de hoy.
- Puedo cambiar la fecha a uno de los 7 días anteriores para corregir.

**H3 Estadísticas.** Veo mi progreso real.
- **Semana:** cumplimiento por hábito y total, navegable hacia atrás. **Mes:** calendario por hábito (hecho / no hecho / no programado). **Histórico:** cumplimiento por mes, racha actual y mejor racha. **Foco:** minutos por día y semana.
- Todo se calcula desde los datos; sin datos se muestra un estado vacío, nunca datos de ejemplo. La lógica tiene tests con casos borde: semanas parciales, archivados, fecha de inicio a mitad de semana, cambio de año.

**H4 Foco.** Inicio un temporizador y registro la sesión.
- Duraciones configurables (por defecto 25/5), asociables a un hábito u objetivo. El tiempo se calcula con marcas de tiempo: bloquear el teléfono o recargar no lo desajusta.
- La sesión se guarda al terminar o al detenerla con los minutos reales; las de < 1 min se descartan. Sin notificaciones push en v1 (iOS no lo permite sin servidor de push).

**H5 Objetivos.** Creo objetivos con hitos y fecha límite.
- Progreso = hitos hechos ÷ total. Muestra los días restantes o "vencido". Puedo vincular hábitos (un hábito pertenece a 0 o 1 objetivo).

**H6 Diario y notas.** Escribo una entrada breve al día y guardo notas.
- Diario: una entrada por fecha, editable, con un listado por fecha.
- Notas: Markdown renderizado y **sanitizado**, etiquetas, búsqueda por texto y por etiqueta.

**H7 Ajustes.** Elijo paleta (Índigo / Océano) y modo (Claro / Oscuro / Automático) con `window.Tema`; se aplica al instante y persiste. Zona horaria, cerrar sesión y papelera.

**H8 Respaldo y salida de datos.**
- Respaldo automático semanal: GitHub Actions ejecuta `supabase db dump` (esquema + datos), lo cifra (age) y lo sube a **Cloudflare R2**. Conserva las últimas 12 copias.
- Script de restauración documentado y probado contra Supabase local.
- En Ajustes: "Descargar mis datos" en JSON y CSV (solo exportar, sin importar en la app).
- Informe imprimible (semana / mes / histórico) con CSS de impresión, para guardarlo como PDF desde iOS.

## Seguridad y calidad (aplica a todas las fases)
- RLS activado en todas las tablas, con tests de que otro usuario no ve ni escribe datos ajenos.
- El texto del usuario se muestra solo escapado (React). El único HTML es Markdown pasado por DOMPurify. Cabeceras CSP en Cloudflare.
- Errores de entrada y de red visibles con `--danger` y mensajes en español. axe sin violaciones serias en cada pantalla.
- Commits pequeños. Al cerrar cada fase se reporta: implementado / probado / errores corregidos / pendiente.

## Fases
F0 base: repo, Supabase local, auth, tema y Ajustes, navegación, PWA instalable, CI y despliegue · F1 hábitos + Hoy + rachas · F2 estadísticas · F3 foco · F4 objetivos · F5 diario y notas · F6 respaldo y salida de datos.

## Fuera de alcance (v1)
Varios usuarios, funciones sociales, notificaciones push, registrar sin conexión, importar en la app, gamificación o adornos.

## Lo decide quien construye
Librerías concretas (router, manejo de datos, Markdown, formularios), estructura de carpetas, iconos y layout de navegación, siempre dentro de las restricciones de arriba.
