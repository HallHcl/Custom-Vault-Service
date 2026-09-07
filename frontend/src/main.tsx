import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.tsx'
import { applyTheme, getCachedTheme } from './lib/theme'

// Re-assert the cached theme on the <html> element. The pre-paint script in
// index.html already did this before first paint; this covers dev HMR reloads
// and keeps the two code paths using the same cache. The authoritative account
// value is applied by ThemeProvider once GET /api/auth/me resolves.
applyTheme(getCachedTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
