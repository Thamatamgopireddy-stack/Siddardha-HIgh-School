import { useState, useEffect } from 'react'
import { Menu, Bell, LogOut, User, Sun, Moon, RotateCcw, Cpu, Wifi, WifiOff } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUIStore, useAuthStore } from '@/store'
import { Badge } from '@/components/ui/Badge'
import { ROLE_LABELS } from '@/utils'
import { api } from '@/api/client'
import { Avatar } from '@/components/shared/Avatar'
import { resetMockDb } from '@/api/mockDb'
import { socketService, ConnectionStatus } from '@/services/websocket'
import { toast } from 'sonner'

export function Header() {
  const toggleMobileSidebar = useUIStore((s) => s.toggleMobileSidebar)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const darkMode = useUIStore((s) => s.darkMode)
  const toggleDarkMode = useUIStore((s) => s.toggleDarkMode)
  const navigate = useNavigate()
  const location = useLocation()

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>(socketService.status)

  useEffect(() => {
    const unsub = socketService.onStatusChange((status) => setWsStatus(status))
    return () => {
      unsub()
    }
  }, [])

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
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 z-30 relative">
      <div className="flex items-center gap-3">
        <button
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={toggleMobileSidebar}
          title="Open Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <nav className="hidden text-sm capitalize text-slate-500 sm:block">
          {breadcrumbs.join(' / ') || 'Dashboard'}
        </nav>
        {localStorage.getItem('use_mock_api') === 'true' && (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
            <Cpu className="h-3 w-3 animate-pulse text-emerald-500" />
            <span>Demo Mode</span>
            <button
              onClick={() => {
                if (confirm('Reset mock database to defaults? Any changes will be lost.')) {
                  resetMockDb()
                  toast.success('Database reset and seeded!')
                  setTimeout(() => window.location.reload(), 500)
                }
              }}
              title="Reset Mock Database"
              className="ml-1.5 rounded-full p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors text-emerald-600 dark:text-emerald-400"
            >
              <RotateCcw className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* Real-time Socket Connection Status */}
        <div
          title={`Real-Time Socket: ${wsStatus}`}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 transition-colors cursor-pointer"
          onClick={() => {
            if (wsStatus === 'disconnected') {
              const token = useAuthStore.getState().accessToken
              socketService.connect(token || undefined)
            }
          }}
        >
          {wsStatus === 'connected' ? (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden md:inline text-3xs uppercase tracking-wider">Live Socket</span>
            </span>
          ) : wsStatus === 'connecting' ? (
            <span className="flex items-center gap-1.5 text-amber-500 font-medium">
              <Wifi className="h-3.5 w-3.5 animate-pulse" />
              <span className="hidden md:inline text-3xs uppercase tracking-wider">Connecting</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-400 font-medium">
              <WifiOff className="h-3.5 w-3.5" />
              <span className="hidden md:inline text-3xs uppercase tracking-wider">Offline</span>
            </span>
          )}
        </div>

        <button
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
          }}
          className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-400 sm:flex dark:border-slate-800 dark:bg-slate-900/50"
        >
          <span>Search...</span>
          <kbd className="rounded bg-white px-1 py-0.5 text-3xs font-mono border shadow-sm dark:bg-slate-800 dark:border-slate-700">Ctrl K</kbd>
        </button>
        
        {/* Night/Dark Mode Toggle Button */}
        <button
          onClick={toggleDarkMode}
          className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
          title={darkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
        >
          {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
        </button>

        <button className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />
        </button>
        {user && <Badge variant="info">{ROLE_LABELS[user.role] || user.role}</Badge>}
        
        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-transparent p-0 border-0 focus:outline-none cursor-pointer"
          >
            <Avatar src={user?.profile_photo_url} firstName={user?.first_name} lastName={user?.last_name} size="sm" />
          </button>
          
          {isDropdownOpen && (
            <>
              {/* Overlay click-away listener */}
              <div 
                className="fixed inset-0 z-40 bg-transparent" 
                onClick={() => setIsDropdownOpen(false)} 
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-md dark:border-slate-700 dark:bg-slate-900">
                <button 
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-left cursor-pointer" 
                  onClick={() => {
                    setIsDropdownOpen(false)
                    navigate('/settings')
                  }}
                >
                  <User className="h-4 w-4" /> Profile
                </button>
                <button 
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-slate-50 dark:hover:bg-slate-800 text-left cursor-pointer" 
                  onClick={() => {
                    setIsDropdownOpen(false)
                    handleLogout()
                  }}
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}


