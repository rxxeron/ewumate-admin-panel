import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './components/ThemeContext.tsx'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            borderRadius: '12px',
            padding: '14px 20px',
            fontSize: '14px',
            fontWeight: 500,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.08)',
          },
          success: {
            iconTheme: { primary: '#34d399', secondary: '#064e3b' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#7f1d1d' },
            duration: 6000,
          },
        }}
      />
      <App />
    </ThemeProvider>
  </StrictMode>,
)

