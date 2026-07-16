import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUIStore } from '@/store'
import { cn } from '@/utils'
import { CommandPalette } from '@/components/shared/CommandPalette'

export function AppLayout() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
      <div className={cn('hidden lg:block shrink-0', sidebarCollapsed ? 'w-16' : 'w-64')}>
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
