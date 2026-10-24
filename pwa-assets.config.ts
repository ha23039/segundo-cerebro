import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Fondo índigo (primary de tokens.css) para que iOS no rellene las esquinas de blanco.
const background = '#4f46e5'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
})
