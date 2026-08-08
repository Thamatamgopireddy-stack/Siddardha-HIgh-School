import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUIStore } from '@/store'
import { cn } from '@/utils'
import { CommandPalette } from '@/components/shared/CommandPalette'

export function AppLayout() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen)
  const location = useLocation()

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname, setMobileSidebarOpen])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
      {/* Desktop Sidebar */}
      <div className={cn('hidden lg:block shrink-0', sidebarCollapsed ? 'w-16' : 'w-64')}>
        <Sidebar />
      </div>

      {/* Mobile Sidebar Slide-over Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar text-white shadow-2xl animate-in slide-in-from-left duration-200">
            <Sidebar onItemClick={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col relative">
        <Header />
        <main className="relative flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="relative z-10">
            <Outlet />
          </div>
        </main>
        {/* Overlay Watermark Background Image */}
        <div 
          className="pointer-events-none absolute z-20 opacity-[0.15] dark:opacity-[0.06]"
          style={{ 
            backgroundImage: 'url("/logo.jpg")',
            backgroundSize: 'cover',
            width: 'min(75vw, 750px)',
            height: 'min(75vw, 750px)',
            borderRadius: '50%',
            left: '50%',
            top: 'calc(50% + 2rem)',
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>
      <CommandPalette />
    </div>
  )
}
