import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../profile/useProfile'
import { DEFAULT_LAYOUT, resolveLayout, type TodayLayout } from './domain/layout'

type Profile = { timezone: string; today_layout: unknown }

/** Orden y visibilidad de las tarjetas de Hoy. Cambia al instante (optimista) y se guarda en el perfil. */
export function useTodayLayout() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const profile = useProfile()
  const layout = profile.data ? resolveLayout(profile.data.today_layout) : DEFAULT_LAYOUT

  const save = useMutation({
    mutationFn: async (next: TodayLayout) => {
      const { error } = await supabase.from('profiles').update({ today_layout: { order: [...next.order], hidden: [...next.hidden] } }).eq('user_id', session!.user.id)
      if (error) throw error
    },
    scope: { id: 'today-layout' },
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ['profile'] })
      const previous = queryClient.getQueryData<Profile>(['profile'])
      if (previous) queryClient.setQueryData<Profile>(['profile'], { ...previous, today_layout: next })
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['profile'], ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  })

  return { layout, ready: profile.isSuccess, save, error: save.error }
}
