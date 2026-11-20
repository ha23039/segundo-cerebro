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
- `daily_priorities`: hasta 3 prioridades por día (posición 1..3), título ≤ 120, hecha.
- `rest_days` *(APEX)*: día de descanso planificado, nota opcional ≤ 120. Único por (usuario, fecha).
- `habit_skips` *(APEX)*: omisión justificada de un hábito un día, con motivo (`enfermedad` | `viaje` | `imprevisto` | `descanso` | `otro`). Única por (hábito, fecha).
- `focus_sessions`: inicio, fin, minutos planificados, minutos reales, tipo (foco | descanso), hábito u objetivo opcional.
- `goals`: título, descripción, inicio (`start_date`, hoy al crear), fecha límite, estado (activo | completado | abandonado), `completed_at`, `deleted_at` (papelera con purga a los 30 días). `milestones`: objetivo, título, hecho, `done_at`, orden.
- `journal_entries`: fecha (única por usuario), texto ≤ 2000 caracteres.
- `notes`: título, cuerpo en Markdown, etiquetas (`text[]`), búsqueda de texto completo en español, `deleted_at`.
- Validación en el cliente y restricciones en la BD (longitudes, `check`, valores > 0).

## Reglas de cálculo
- **Programado:** un día está programado si cae dentro de un periodo de `habit_schedules` y, en `dias`, es uno de sus días de la semana. Un hábito `semanal` se mide por semana. El tipo (`check` / `cantidad`) no se puede cambiar después de crear el hábito.
- **Hecho:** `check` → hay registro; `cantidad` → valor ≥ meta.
- **Racha (`dias`):** días programados consecutivos hechos. Los días no programados no la rompen; hoy pendiente no la rompe hasta que termina el día. **Racha (`semanal`):** semanas consecutivas con ≥ N; la semana en curso no la rompe.
- **Semanas parciales (`semanal`)** *(decisión de Claude)*: la semana en que empieza o termina un periodo de horario (crear, editar, archivar), no cuenta para el cumplimiento y no rompe la racha. Si en esa semana llega a N, sí suma a la racha.
- **Descansos y omisiones** *(decisión de Claude, 2026-11-15)*: un día de descanso excusa todos los hábitos y no tiene puntuación; una omisión justificada excusa un hábito ese día. Lo excusado no puntúa, no cuenta en la constancia ni en las medias y no rompe rachas (ni suma). Si igualmente se hizo, cuenta como hecho. En `semanal`, cada omisión rebaja en 1 el objetivo de esa semana y los descansos quitan días disponibles: objetivo = min(N − omisiones, 7 − omisiones − descansos); una semana con objetivo 0 se salta. Ventana: desde 7 días atrás hasta 90 adelante (planificar), validada en la BD.
- **Bloques horarios** *(decisión de Claude, 2026-11-18)*: un hábito puede tener hora de inicio y, opcionalmente, de fin (`habits.start_time`/`end_time`, hora de reloj sin zona, interpretada en la zona del perfil; el fin exige inicio y ser posterior). No afecta a la puntuación ni a las rachas, y editarla no abre un periodo nuevo (no reescribe el historial). «Lo que queda de hoy» lista lo pendiente con hora, ordenado por inicio: hoy marca *Ahora* (dentro del bloque) y *Atrasado* (el bloque ya pasó sin hacerse); un bloque sin fin dura 30 minutos. Lo hecho, omitido o en día de descanso no aparece. Otros días se muestra como «Horario del día», sin estados.
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
- Todo se calcula desde los datos; sin datos se muestra un estado vacío, nunca datos de ejemplo.
- **Reglas de cálculo de las estadísticas** *(decisión de Claude, 2026-11-18)*: la pantalla se llama «Estadísticas» y su pestaña de navegación «Progreso» (cinco pestañas caben a 320 px). Cumplimiento = hechos ÷ programados. `dias`: día a día; hoy solo cuenta si está hecho; los días futuros no cuentan; un descanso o una omisión justificada no cuentan (si se hizo, sí). `semanal`: por semana completa, hechos (con tope en N) ÷ objetivo de la semana (rebajado por omisiones y descansos); se excluyen las semanas parciales (cambio de periodo a mitad), las excusadas por completo y la semana en curso mientras no llegue al objetivo. Una semana pertenece al mes de su jueves (ISO). Los hábitos archivados cuentan con su historial; los de la papelera no. Sin días programados se muestra «—», nunca 0 %. Mejor racha: mismas reglas que la racha actual. Racha y mejor racha globales: días con puntuación ≥ 70. La vista Foco queda para F3 (aún no hay sesiones). La lógica tiene tests con casos borde: semanas parciales, archivados, fecha de inicio a mitad de semana, cambio de año.

**H4 Foco.** Inicio un temporizador y registro la sesión.
- Duraciones configurables (por defecto 25/5), asociables a un hábito u objetivo. El tiempo se calcula con marcas de tiempo: bloquear el teléfono o recargar no lo desajusta.
- La sesión se guarda al terminar o al detenerla con los minutos reales; las de < 1 min se descartan. Sin notificaciones push en v1 (iOS no lo permite sin servidor de push).
- **Cómo se resuelve** *(decisión de Claude, 2026-11-20)*: el temporizador es una tarjeta «Foco» en Hoy (no una pestaña: la barra inferior ya tiene cinco), con un aviso en el resto de pantallas mientras corre y los minutos en el título de la pestaña. Duraciones: 15/25/45/60 o cualquier valor de 1 a 240 min, y descanso de 5/10/15; se recuerdan en el dispositivo (25/5 por defecto). El temporizador en curso se guarda en el dispositivo con su hora de inicio, así que sobrevive a recargar o cerrar la app; si terminó mientras no estaba, se guarda al volver con el tiempo planificado (no cuenta el tiempo ocioso). Minutos reales = minutos completos transcurridos; menos de 1 minuto se descarta. El id de la sesión se fija al empezar, así que reintentar el guardado (p. ej. sin red) nunca la duplica. Los descansos se guardan con tipo `descanso` y no suman al foco. La BD valida que los minutos reales coincidan con el tiempo transcurrido y que la sesión no termine en el futuro. Las sesiones solo se crean y se borran. Estadísticas → Foco: minutos por día de la semana, últimas 8 semanas y lista de sesiones (la sesión cuenta en el día, en la zona del perfil, en que empezó).

**H5 Objetivos.** Creo objetivos con hitos y fecha límite.
- Progreso = hitos hechos ÷ total. Muestra los días restantes o "vencido". Puedo vincular hábitos (un hábito pertenece a 0 o 1 objetivo).
- **Ritmo esperado** *(decisión de Claude, 2026-11-18)*: el plazo se reparte de forma lineal entre el inicio y la fecha límite; lo esperado hoy es la parte del plazo transcurrida (0–100 %), y se compara con el avance real (hitos hechos ÷ total). Dentro de ±10 puntos es *en ritmo*; por encima, *adelantado*; por debajo, *atrasado*. Pasada la fecha límite sin completar es *vencido* (el propio día del límite aún no). Sin hitos no hay ritmo (*sin hitos*, solo el plazo). La barra de progreso lleva una marca en el avance esperado y se muestra «Ritmo esperado: N de M hoy». Hoy avisa de los objetivos activos que vencen en ≤ 7 días o ya vencidos.

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
