import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'

export function useFocusSessions() {
  return useQuery({ queryKey: ['focus'], queryFn: api.fetchFocus })
}

export function useSaveSession() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: api.saveSession, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['focus'] }) })
}

export function useDeleteSession() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: api.deleteSession, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['focus'] }) })
}
