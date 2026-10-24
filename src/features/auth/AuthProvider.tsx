import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { clearPersistedCache } from '../../lib/queryClient'
import { readStoredSession, supabase } from '../../lib/supabase'
import { AuthContext, type AuthValue } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // getSession refresca el token si caducó. Sin red, auth-js reintenta hasta ~30 s: mientras
    // tanto (o si falla por la red) se usa la sesión guardada en modo solo lectura.
    let resolved = false
    const applyStored = () => {
      const stored = readStoredSession()
      if (stored) setSession((current) => current ?? stored)
      setLoading(false)
    }
    if (!navigator.onLine) applyStored()
    const fallback = window.setTimeout(() => {
      if (!resolved) applyStored()
    }, 4000)

    const load = () =>
      supabase.auth
        .getSession()
        .then(({ data, error }) => {
          resolved = true
          if (data.session) setSession(data.session)
          else if (error && isAuthRetryableFetchError(error)) setSession(readStoredSession())
          else setSession(null)
        })
        .catch(() => setSession(readStoredSession()))
        .finally(() => setLoading(false))

    load()
    window.addEventListener('online', load)
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      // INITIAL_SESSION sin sesión puede deberse a la red: lo resuelve load()
      if (event !== 'INITIAL_SESSION') setSession(s)
    })
    return () => {
      window.clearTimeout(fallback)
      window.removeEventListener('online', load)
      data.subscription.unsubscribe()
    }
  }, [])

  const value: AuthValue = {
    session,
    loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signOut() {
      await clearPersistedCache()
      await supabase.auth.signOut({ scope: 'local' })
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
