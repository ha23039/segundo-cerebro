import { QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useEffect, type ReactNode } from 'react'
import { CACHE_MAX_AGE, enablePersistence, persister, queryClient } from './queryClient'

/** Con sesión, la caché se guarda en IndexedDB (lectura sin red); sin sesión, solo en memoria. */
export function AppQueryProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  useEffect(() => {
    if (userId) enablePersistence()
  }, [userId])

  if (!userId) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: userId }}
      // Lo restaurado puede ser anterior al último cambio (la escritura va con retardo):
      // con red se refresca todo; sin red se queda lo restaurado.
      onSuccess={() => queryClient.invalidateQueries()}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
