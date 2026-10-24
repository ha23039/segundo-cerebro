import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/tokens-extra.css'
import './styles/base.css'
import App from './App'
import { syncThemeColor } from './lib/theme'

syncThemeColor()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
