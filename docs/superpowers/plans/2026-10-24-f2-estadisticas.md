# F2 (Estadísticas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pantalla de Estadísticas con vista de semana, mes e histórico, calculadas siempre a partir de los datos reales del usuario.

**Architecture:** Los cálculos se hacen en TypeScript puro (`src/features/stats/domain/`) sobre el mismo `Habit` y `LogsByDate` que usa Hoy. Así hay una sola fuente de verdad para las reglas de la spec, y se reutilizan `periodAt`, `isDone` y `weekDoneCount`. Los datos son la misma consulta `['logs', from]` que ya tiene Hoy (caché compartida, también sin red). No se añade nada en SQL. *(Decisión: el agregado en servidor se reconsidera si un día la carga inicial supera ~1 s en el iPhone.)*

**Tech Stack:** el de F0/F1, sin librerías de gráficos: barras con CSS y variables de tokens. Antes de dibujar cualquier barra o calendario se carga el skill `dataviz`. Para sembrar datos en los E2E se añade `postgres@3` (devDependency).

**Spec:** `docs/spec.md` (H3 Estadísticas y "Reglas de cálculo")

## Global Constraints

- Todas las de `2026-10-24-f0-f1-base-habitos.md` (español, solo variables de color, táctil ≥ 44 px, inputs de 16 px, RLS, sin `dangerouslySetInnerHTML`).
- **Nunca se muestran datos de ejemplo.** Sin días programados en un periodo se muestra "—", no 0 %. Sin hábitos aparece el estado vacío 'Aún no hay datos para mostrar'.
- Se incluyen los hábitos archivados (su historial cuenta). Los de la papelera no.
- Se reutilizan las funciones del dominio de hábitos: no se duplican reglas.
- Antes de cada commit hay que revisar `git status` y ejecutar `npm run check:tracked`.

## Reglas de cálculo que fija este plan (además de la spec)

1. **Días futuros:** no cuentan. **Hoy** solo cuenta si está hecho (en el numerador y en el denominador), igual que en las rachas.
2. **Semanal en la semana actual:** solo cuenta si ya llegó a N. Si no, se excluye, porque la semana está en curso.
3. **Semanal en semanas parciales** (un límite de periodo cae dentro de la semana): se excluyen, como dice la spec.
4. **A qué mes pertenece una semana semanal:** al mes de su jueves (convención ISO). Los hábitos por días se asignan día a día.
5. **Total de un periodo:** suma de hechos ÷ suma de programados de todos los hábitos (spec).
6. **Mejor racha:** con las mismas reglas que la racha actual, en la unidad del último periodo, y solo contando tramos con esa misma frecuencia.

## Review Focus

1. **Primera semana del año e inicio a mitad de mes:** el mes de diciembre no debe contar la semana que pertenece a enero. Test en Task 1.
2. **Hábito archivado a mitad de semana:** no debe bajar el cumplimiento de esa semana con días que ya no tocaban. Test en Task 1.
3. **Usuario sin registros pero con hábitos:** debe mostrar 0 % (había días programados), no "—". Test en Task 1.
4. **Navegar a una semana o mes anterior a la creación del primer hábito:** debe mostrar "—" y no fallar. E2E en Task 4.
5. **Cuatro pestañas en la barra inferior a 320 px:** sin desbordar. E2E en Task 4.

---

## Estructura de archivos

```
src/features/stats/domain/compliance.ts   dayStatus, compliance, weekRange, monthRange, monthlySeries, ratio
src/features/stats/domain/best.ts         bestStreak
src/features/stats/StatsPage.tsx          pestañas Semana | Mes | Histórico (estado en ?vista=)
src/features/stats/WeekView.tsx, MonthView.tsx, HistoryView.tsx, stats.css
src/features/stats/useStatsData.ts        habits (incl. archivados) + logs desde el primer validFrom
e2e/db.ts                                 seedLogs(): inserta registros antiguos saltando el trigger de ventana
e2e/stats.spec.ts
```

---

### Task 1: Cumplimiento (dominio)

**Files:** Create `src/features/stats/domain/compliance.ts`, `src/features/stats/domain/compliance.test.ts`.

**Interfaces — Produces:**
```ts
export type DayStatus = 'hecho' | 'no-hecho' | 'no-programado' | 'pendiente' | 'futuro'
export interface Count { done: number; scheduled: number }
export function dayStatus(h: Habit, logs: LogsByDate, date: IsoDate, today: IsoDate): DayStatus
// dias: según isScheduledDay; semanal: 'hecho' si está hecho, si no 'no-programado'; date>today → 'futuro'; hoy sin hacer → 'pendiente'
export function compliance(h: Habit, logs: LogsByDate, from: IsoDate, to: IsoDate, today: IsoDate): Count
export function sumCounts(counts: Count[]): Count
export function ratio(c: Count): number | null            // null si scheduled === 0
export function weekRange(date: IsoDate): { from: IsoDate; to: IsoDate }   // lunes..domingo
export function monthRange(month: string): { from: IsoDate; to: IsoDate }  // 'YYYY-MM'
export function monthlySeries(habits: Habit[], logs: Map<string, LogsByDate>, fromMonth: string, today: IsoDate): { month: string; count: Count }[]
```
Consumes: `periodAt`, `isScheduledDay`, `isDone`, `weekDoneCount` (dominio de hábitos), `addDays`, `startOfWeek`, `isoWeekday` (lib/dates). Los helpers `dias`, `semanal`, `habit` y `logs` vienen de `habits/domain/testing.ts`.

- [ ] **Step 1: Tests que fallan.** Hoy = '2026-10-28' (miércoles).
  - `dias` L-V desde 2026-10-05, hechos todos los días laborables del 05-10 al 23-10 menos el 14-10, ninguno en la semana actual → `compliance(…, '2026-10-12', '2026-10-18')` = `{done:4, scheduled:5}`.
  - Semana actual (26 a 01-11) sin registros: lunes y martes son fallos, hoy pendiente no cuenta y lo posterior es futuro → `{done:0, scheduled:2}`. Con hoy hecho → `{done:1, scheduled:3}`.
  - Review Focus 3: con hábitos y sin ningún registro → `ratio` = 0, no `null`.
  - Antes de la creación → `{0,0}` y `ratio` → `null`.
  - Review Focus 2: archivado el jueves 2026-10-15 (periodo `[05-10, 14-10]`), con lunes y martes hechos → semana 12-18 = `{done:2, scheduled:3}` (solo cuentan lunes a miércoles).
  - `semanal` N=3 desde 2026-10-05, con 2 hechos en la semana 12-18 → `{done:2, scheduled:3}`. Con 4 hechos → `{3,3}`.
  - `semanal` creado el jueves 2026-10-15 (semana parcial) → la semana 12-18 = `{0,0}`.
  - `semanal`, semana actual con 1 de 3 → `{0,0}`. Con 3 de 3 → `{3,3}`.
  - Review Focus 1: `monthlySeries` para un `semanal` N=1 desde 2026-11-30, con un hecho cada semana hasta hoy = '2027-01-13'. La semana del 28-12 al 03-01 (jueves 31-12) cuenta en diciembre de 2026 y la del 04-01 en enero. Por tanto diciembre = `{done:5, scheduled:5}` (semanas con jueves en diciembre: 03, 10, 17, 24 y 31) y enero = `{2,2}` (semanas del 04-01 y del 11-01; la actual cuenta porque ya está cumplida).
  - `sumCounts` y `ratio({3,4})` = 0.75.
  - `dayStatus`: casos 'hecho', 'no-hecho' (dias programado pasado), 'no-programado' (sábado con L-V), 'pendiente' (hoy) y 'futuro'.
- [ ] **Step 2:** `npx vitest run src/features/stats` → FAIL. Implementar → PASS. Commit `feat: cálculo de cumplimiento por semana y mes`.

### Task 2: Mejor racha (dominio)

**Files:** Create `src/features/stats/domain/best.ts`, `best.test.ts`.

**Interfaces — Produces:** `export function bestStreak(h: Habit, logs: LogsByDate, today: IsoDate): Streak | null`. Devuelve null si no tiene periodos. Funciona también con hábitos archivados.

- [ ] **Step 1: Tests que fallan.** Hoy = '2026-10-28'.
  - Diario desde 2026-09-28, hecho del 28-09 al 17-10 (20 días), fallo el 18-10 y hecho del 19-10 al 27-10 (9 días) → `bestStreak` = 20 días y `currentStreak` = 9 días (comprobación cruzada).
  - Semanal N=2, con tramos de 3 semanas y de 1 semana separados por una semana fallida → 3 semanas.
  - Archivado tras una racha de 5 días → 5 días (la actual es null).
  - Sin ningún registro → `{value: 0, unit: 'dias'}`.
- [ ] **Step 2:** FAIL. Implementar recorriendo hacia delante con las mismas reglas que `currentStreak` → PASS. Commit `feat: mejor racha histórica`.

### Task 3: Siembra de datos antiguos para E2E

**Files:** Create `e2e/db.ts`; Modify `package.json` (devDependency `postgres`), `.env.example` (`SUPABASE_DB_URL`) y el paso de `.env.local` del CI.

**Interfaces — Produces:** `export async function seedLogs(habitId: string, userId: string, entries: { date: IsoDate; value?: number }[]): Promise<void>`. Conecta a `SUPABASE_DB_URL` (local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`) y, dentro de una transacción con `set local session_replication_role = replica`, inserta los registros saltando el trigger de ventana. Solo se usa en tests y nunca contra producción: falla si la URL no apunta a `127.0.0.1` o `localhost`.

- [ ] **Step 1:** Test E2E mínimo en `e2e/stats.spec.ts` (`seedLogs inserta registros de hace 40 días`). Crear un hábito con `seedHabit(…, 60)`, sembrar `today-40` y leer con el admin client que existe la fila → FAIL (no existe `e2e/db.ts`).
- [ ] **Step 2:** Implementar → PASS. Además, comprobar que `seedLogs` lanza error si `SUPABASE_DB_URL` apunta a otro host. Commit `test: siembra de registros antiguos para E2E`.

### Task 4: Página de Estadísticas y vista Semana

**Files:** Create `StatsPage.tsx`, `WeekView.tsx`, `useStatsData.ts`, `stats.css`; Modify `App.tsx` (ruta `/estadisticas`) y `BottomNav.tsx` (pestaña 'Estadísticas' entre Hábitos y Ajustes). Test: `e2e/stats.spec.ts`.

UI:
- Pestañas accesibles (`role="tablist"`): Semana, Mes e Histórico, con la vista en `?vista=`.
- La semana muestra un rango ('19–25 oct 2026'), botones 'Semana anterior' y 'Semana siguiente' (deshabilitado en la actual) y una tarjeta de total ('75 %', '6 de 8').
- Por hábito: nombre, barra de porcentaje con `role="img"` y `aria-label`, 'x de y' y siete casillas L a D con su estado (`aria-label` 'lunes 19: hecho'). Colores: hecho `--ok`, no hecho `--danger`, el resto `--border`.

- [ ] **Step 1: E2E que fallan.** Datos: 'Leer' L-V con inicio hace 21 días y la semana anterior hecha toda menos el miércoles; 'Gimnasio' semanal N=3 con 2 hechos la semana anterior.
  - 'Semana anterior' → 'Leer' muestra '4 de 5' y '80 %'; 'Gimnasio' '2 de 3'; el total '6 de 8' y '75 %'.
  - Review Focus 4: retroceder 5 semanas → los dos hábitos con '—' y sin errores.
  - Sin hábitos → 'Aún no hay datos para mostrar'.
  - Review Focus 5: a 320 px, `scrollWidth <= 320` con 4 pestañas.
  - axe sin violaciones.
- [ ] **Step 2:** Implementar (cargando antes el skill `dataviz` para barras y casillas) → PASS. Commit `feat: estadísticas de la semana`.

### Task 5: Vista Mes

**Files:** Create `MonthView.tsx`; Modify `StatsPage.tsx`. Test: `e2e/stats.spec.ts`.

UI:
- Navegación por meses ('octubre de 2026', anterior y siguiente) y un `select` con la etiqueta 'Hábito'.
- Calendario de 7 columnas (L a D) con las casillas como `role="img"` y `aria-label` '5 de octubre: hecho'.
- Leyenda, cumplimiento del hábito en el mes y total del mes con todos los hábitos.

- [ ] **Step 1: E2E que fallan.** 'Leer' L-V con inicio hace 70 días y registros sembrados en el mes anterior: todos los laborables menos el primer martes.
  - 'Mes anterior' → la casilla del primer martes dice 'no hecho', la del primer lunes 'hecho' y la del primer sábado 'no programado'.
  - El cumplimiento coincide con `(laborables − 1) / laborables`, calculado en el test.
  - axe sin violaciones.
- [ ] **Step 2:** Implementar → PASS. Commit `feat: estadísticas del mes con calendario por hábito`.

### Task 6: Vista Histórico

**Files:** Create `HistoryView.tsx`; Modify `StatsPage.tsx`. Test: `e2e/stats.spec.ts`.

UI:
- Por hábito (también los archivados, marcados como tales): racha actual, mejor racha y cumplimiento total desde el inicio.
- Debajo, el cumplimiento total por mes de los últimos 12 meses con datos: barras horizontales accesibles (tabla con 'Mes', '%' y 'hechos/programados', y la barra como decoración).

- [ ] **Step 1: E2E que fallan.** Diario con inicio hace 30 días: hecho de −30 a −11, fallo en −10 y hecho de −9 a −1.
  - 'Histórico' → 'Racha actual: 9 días' y 'Mejor racha: 20 días'.
  - La tabla de meses tiene una fila por cada mes con días programados.
  - Un hábito archivado aparece con la etiqueta 'Archivado'.
  - axe sin violaciones.
  - Sin red, tras cargar, el histórico se sigue viendo (caché compartida).
- [ ] **Step 2:** Implementar (con el skill `dataviz`) → PASS. Commit `feat: histórico con rachas y cumplimiento mensual`.

### Task 7: Cierre de F2

- [ ] **Step 1:** Suite completa en local (`check:tracked`, `lint`, `typecheck`, `check:colors`, `test`, `supabase test db`, `e2e`) y capturas en claro y oscuro de las tres vistas, revisadas a mano.
- [ ] **Step 2:** PR `feat/f2` → CI verde → revisión final independiente → una ronda de correcciones.
- [ ] **Step 3:** Actualizar `docs/despliegue.md` si hace falta (F2 no lleva migraciones). **Reporte de fase F2:** implementado / probado / errores corregidos / pendiente.
