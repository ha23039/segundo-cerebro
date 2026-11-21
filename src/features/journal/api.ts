import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import type { NoteInput } from './schema'
import type { JournalEntry, Note } from './domain/types'

type EntryRow = Database['public']['Tables']['journal_entries']['Row']
type NoteRow = Database['public']['Tables']['notes']['Row']
const PAGE = 1000

const toEntry = (r: EntryRow): JournalEntry => ({ id: r.id, date: r.entry_date, body: r.body, updatedAt: r.updated_at })
const toNote = (r: NoteRow): Note => ({ id: r.id, title: r.title, body: r.body, tags: r.tags, pinned: r.pinned, updatedAt: r.updated_at, deletedAt: r.deleted_at })

/** Todas las entradas, de la más reciente a la más antigua. */
export async function fetchEntries(): Promise<JournalEntry[]> {
  const out: JournalEntry[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }).range(offset, offset + PAGE - 1)
    if (error) throw error
    out.push(...data.map(toEntry))
    if (data.length < PAGE) return out
  }
}

/** Crea o reemplaza la entrada de esa fecha (una por día). */
export async function saveEntry(date: string, body: string): Promise<void> {
  const { error } = await supabase.from('journal_entries').upsert({ entry_date: date, body }, { onConflict: 'user_id,entry_date' })
  if (error) throw error
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('journal_entries').delete().eq('id', id)
  if (error) throw error
}

/** Notas activas (fijadas primero, luego las más recientes). Con `query`, búsqueda de texto completo en español. */
export async function fetchNotes(query: string): Promise<Note[]> {
  const out: Note[] = []
  for (let offset = 0; ; offset += PAGE) {
    let q = supabase.from('notes').select('*').is('deleted_at', null)
    const text = query.trim()
    if (text) q = q.textSearch('search', text, { config: 'spanish', type: 'websearch' })
    const { data, error } = await q.order('pinned', { ascending: false }).order('updated_at', { ascending: false }).range(offset, offset + PAGE - 1)
    if (error) throw error
    out.push(...data.map(toNote))
    if (data.length < PAGE) return out
  }
}

export async function fetchDeletedNotes(): Promise<Note[]> {
  const { data, error } = await supabase.from('notes').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
  if (error) throw error
  return data.map(toNote)
}

export async function fetchNote(id: string): Promise<Note | null> {
  const { data, error } = await supabase.from('notes').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toNote(data) : null
}

export async function createNote(i: NoteInput): Promise<string> {
  const { data, error } = await supabase.from('notes').insert({ title: i.title, body: i.body, tags: i.tags, pinned: i.pinned }).select('id').single()
  if (error) throw error
  return data.id
}

export async function updateNote(id: string, i: NoteInput): Promise<void> {
  const { error } = await supabase.from('notes').update({ title: i.title, body: i.body, tags: i.tags, pinned: i.pinned }).eq('id', id)
  if (error) throw error
}

export async function trashNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function restoreNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').update({ deleted_at: null }).eq('id', id)
  if (error) throw error
}
