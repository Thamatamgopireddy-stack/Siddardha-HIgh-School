import { Menu, Bell, LogOut, User } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUIStore, useAuthStore } from '@/store'
import { Badge } from '@/components/ui/Badge'
import { ROLE_LABELS } from '@/utils'
import { api } from '@/api/client'
import { Avatar } from '@/components/shared/Avatar'

export function Header() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()

  const breadcrumbs = location.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/-/g, ' '))

  const handleLogout = async () => {
    try { await api.post('/auth/logout') } catch { /* ignore */ }
    logout()
    navigate('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <button
          className="rounded-lg p-2 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
          onClick={() => { setSidebarCollapsed(false); toggleSidebar() }}
        >
          <Menu className="h-5 w-5" />
        </button>
        <nav className="hidden text-sm capitalize text-slate-500 sm:block">
          {breadcrumbs.join(' / ') || 'Dashboard'}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
          }}
          className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-400 sm:flex dark:border-slate-800 dark:bg-slate-900/50"
        >
          <span>Search...</span>
          <kbd className="rounded bg-white px-1 py-0.5 text-3xs font-mono border shadow-sm dark:bg-slate-800 dark:border-slate-700">Ctrl K</kbd>
        </button>
        <button className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />
        </button>
        {user && <Badge variant="info">{ROLE_LABELS[user.role] || user.role}</Badge>}
        <div className="group relative">
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-transparent p-0 border-0 focus:outline-none">
            <Avatar src={user?.profile_photo_url} firstName={user?.first_name} lastName={user?.last_name} size="sm" />
          </button>
          <div className="invisible absolute right-0 top-full z-50 mt-2 w-44 rounded-lg border border-slate-200 bg-white py-1 opacity-0 shadow-md transition group-hover:visible group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-900">
            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => navigate('/settings')}>
              <User className="h-4 w-4" /> Profile
            </button>
            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-slate-50 dark:hover:bg-slate-800" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

