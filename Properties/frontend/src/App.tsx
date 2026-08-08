import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppRouter } from '@/router'
import { useUIStore, useAuthStore } from '@/store'
import { socketService } from '@/services/websocket'

const queryClient = new QueryClient()

export default function App() {
  const darkMode = useUIStore((s) => s.darkMode)
  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    if (accessToken) {
      socketService.connect(accessToken)
    } else {
      socketService.disconnect()
    }
    return () => socketService.disconnect()
  }, [accessToken])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRouter />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
