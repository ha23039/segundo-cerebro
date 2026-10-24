import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'

export function useUpdateTimezone() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (timezone: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ timezone })
        .eq('user_id', session!.user.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  })
}
