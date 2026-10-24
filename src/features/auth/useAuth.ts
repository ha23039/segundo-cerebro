import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export interface AuthValue {
  session: Session | null
  loading: boolean
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}
