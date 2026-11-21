import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles/tokens.css'
import './styles/tokens-extra.css'
import './styles/base.css'
import './styles/choices.css'
import './styles/areas.css'
import App from './App'
import { syncThemeColor } from './lib/theme'

syncThemeColor()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
