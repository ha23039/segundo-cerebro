import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('timezone').single()
      if (error) throw error
      return data
    },
  })
}
