import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ensureDemoSession } from './lib/supabase.ts'

const root = createRoot(document.getElementById('root')!)

ensureDemoSession()
  .then(() => {
    root.render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    )
  })
  .catch((err: unknown) => {
    root.render(
      <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
        <h1>Couldn't start the app</h1>
        <p>{err instanceof Error ? err.message : String(err)}</p>
      </div>,
    )
  })
