import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BlinkUIProvider, Toaster } from '@blinkdotnew/ui'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { clearFirestoreIndexedDBIfNeeded, installFirestoreCrashGuard } from './lib/clearFirestoreCache'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

// Install crash guard FIRST — catches INTERNAL ASSERTION FAILED at runtime
// and auto-reloads after wiping IndexedDB (prevents "Something went wrong!" screen)
installFirestoreCrashGuard()

// Inner wrapper so BlinkUIProvider can read the live isDark value
function ThemedApp() {
  const { isDark } = useTheme()
  return (
    <BlinkUIProvider theme="linear" darkMode={isDark ? 'dark' : 'light'}>
      <Toaster position="top-right" />
      <App />
    </BlinkUIProvider>
  )
}

// Clear stale Firestore IndexedDB (v3 key = forces re-clear for all users)
// before mounting React — prevents "INTERNAL ASSERTION FAILED" SDK crashes.
clearFirestoreIndexedDBIfNeeded().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    // NOTE: React.StrictMode removed — it double-invokes useEffect in dev,
    // which creates/destroys Firestore onSnapshot listeners rapidly and can
    // trigger "INTERNAL ASSERTION FAILED: Unexpected state" SDK crashes.
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
})

