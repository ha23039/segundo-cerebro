import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { del, get, set } from 'idb-keyval'

const CACHE_KEY = 'segundo-cerebro-cache'
// 7 días de lectura sin conexión. Debe caber en un setTimeout (≤ 24,8 días) porque se usa como gcTime.
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000

// Se desactiva al cerrar sesión para que una escritura pendiente no deje datos en el dispositivo.
let persistEnabled = false

export function enablePersistence(): void {
  persistEnabled = true
}

export const persister = createAsyncStoragePersister({
  key: CACHE_KEY,
  storage: {
    getItem: (k) => get<string>(k).then((v) => v ?? null),
    setItem: (k, v) => (persistEnabled ? set(k, v) : Promise.resolve()),
    removeItem: (k) => del(k),
  },
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { gcTime: CACHE_MAX_AGE, staleTime: 30_000, networkMode: 'offlineFirst', retry: 1 },
    mutations: { networkMode: 'online', retry: 0 },
  },
})

export async function clearPersistedCache(): Promise<void> {
  persistEnabled = false
  queryClient.clear()
  await del(CACHE_KEY)
}
(window as unknown as { __qc: QueryClient }).__qc = queryClient // DEBUG-TEMP
