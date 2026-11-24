/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  /** Clave pública VAPID de los recordatorios; sin ella la app no ofrece activarlos. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}
