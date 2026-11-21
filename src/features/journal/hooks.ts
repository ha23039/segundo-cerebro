import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import type { NoteInput } from './schema'

export function useJournal() {
  return useQuery({ queryKey: ['journal'], queryFn: api.fetchEntries })
}

export function useJournalMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['journal'] })
  return {
    save: useMutation({ mutationFn: ({ date, body }: { date: string; body: string }) => api.saveEntry(date, body), onSuccess }),
    remove: useMutation({ mutationFn: api.deleteEntry, onSuccess }),
  }
}

export function useNotes(query: string) {
  return useQuery({ queryKey: ['notes', 'list', query.trim()], queryFn: () => api.fetchNotes(query) })
}

export function useDeletedNotes() {
  return useQuery({ queryKey: ['notes', 'deleted'], queryFn: api.fetchDeletedNotes })
}

export function useNote(id: string | undefined) {
  return useQuery({ queryKey: ['notes', 'one', id], queryFn: () => api.fetchNote(id!), enabled: !!id })
}

export function useNoteMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['notes'] })
  return {
    create: useMutation({ mutationFn: (i: NoteInput) => api.createNote(i), onSuccess }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: NoteInput }) => api.updateNote(id, input), onSuccess }),
    trash: useMutation({ mutationFn: api.trashNote, onSuccess }),
    restore: useMutation({ mutationFn: api.restoreNote, onSuccess }),
  }
}
