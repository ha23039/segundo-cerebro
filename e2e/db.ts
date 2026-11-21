import postgres from 'postgres'

/**
 * Inserta registros antiguos saltando el trigger de ventana de edición (que solo deja escribir hasta
 * 7 días atrás). Solo para tests: falla si la conexión no es local, para no tocar nunca otra base de datos.
 */
export async function seedLogs(habitId: string, userId: string, entries: { date: string; value?: number }[]): Promise<void> {
  const url = process.env.SUPABASE_DB_URL
  if (!url) throw new Error('Falta SUPABASE_DB_URL en .env.local')
  const host = new URL(url).hostname
  if (host !== '127.0.0.1' && host !== 'localhost') throw new Error(`seedLogs solo se puede usar contra una base local (host: ${host})`)
  if (entries.length === 0) return

  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await sql.begin(async (tx) => {
      await tx`set local session_replication_role = replica`
      await tx`insert into public.habit_logs ${tx(entries.map((e) => ({ habit_id: habitId, user_id: userId, date: e.date, value: e.value ?? 1 })))}`
    })
  } finally {
    await sql.end()
  }
}
