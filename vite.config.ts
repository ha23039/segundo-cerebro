/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Script externo (sin inline) para cumplir la CSP
      injectRegister: 'script',
      includeAssets: ['theme.js', 'favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Segundo Cerebro',
        short_name: 'Cerebro',
        description: 'Hábitos y disciplina diaria',
        lang: 'es',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        // Metadatos del manifest (no CSS): Apex claro de tokens-extra.css
        theme_color: '#f4f6f5',
        background_color: '#f4f6f5',
        // Atajos de pulsación larga (Android y escritorio). En iOS se usan los mismos enlaces desde la app Atajos.
        shortcuts: [
          { name: 'Marcar hábitos', short_name: 'Hábitos', url: '/?accion=habitos', icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Iniciar foco', short_name: 'Foco', url: '/?accion=foco', icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Escribir en el diario', short_name: 'Diario', url: '/diario', icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Nuevo hábito', short_name: 'Nuevo', url: '/habitos/nuevo', icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
        ],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // Recibir y mostrar los recordatorios push (el service worker lo genera Workbox)
        importScripts: ['push-sw.js'],
        navigateFallback: '/index.html',
        // Supabase nunca se cachea en el service worker: los datos sin red salen de IndexedDB
        runtimeCaching: [],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    },
  },
})
