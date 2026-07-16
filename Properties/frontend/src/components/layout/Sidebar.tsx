import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, GraduationCap, CalendarCheck, Clock, FileText, BookOpen,
  Wallet, Banknote, UserCog, DoorOpen, Library, Bus, Home, Megaphone, MessageSquare,
  Mail, BarChart3, Settings, Code2, ChevronLeft,
} from 'lucide-react'
import { cn } from '@/utils'
import { useUIStore, useAuthStore } from '@/store'
import { usePermission } from '@/hooks/usePermission'

const navGroups = [
  {
    label: 'Core',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Academic',
    items: [
      { to: '/students', label: 'Students', icon: Users, permission: 'students:view' },
      { to: '/teachers', label: 'Teachers', icon: GraduationCap },
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck, permission: 'attendance:view' },
      { to: '/timetable', label: 'Timetable', icon: Clock },
      { to: '/examinations', label: 'Examinations', icon: FileText, permission: 'exams:view' },
      { to: '/lms', label: 'LMS', icon: BookOpen },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/fees', label: 'Fees & Accounts', icon: Wallet, permission: 'fees:view' },
      { to: '/payroll', label: 'Payroll', icon: Banknote },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/hr', label: 'HR', icon: UserCog },
      { to: '/admissions', label: 'Admissions', icon: DoorOpen },
      { to: '/library', label: 'Library', icon: Library },
      { to: '/transport', label: 'Transport', icon: Bus },
      { to: '/hostel', label: 'Hostel', icon: Home },
    ],
  },
  {
    label: 'Communication',
    items: [
      { to: '/noticeboard', label: 'Noticeboard', icon: Megaphone },
      { to: '/messaging', label: 'Messaging', icon: MessageSquare },
      { to: '/circulars', label: 'Circulars', icon: Mail },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports:view' },
      { to: '/settings', label: 'Settings', icon: Settings, permission: 'settings:view' },
      { to: '/developer', label: 'Developer Panel', icon: Code2, permission: 'developer:access' },
    ],
  },
]

function NavItem({ to, label, icon: Icon, collapsed }: { to: string; label: string; icon: React.ElementType; collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive ? 'bg-accent text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  )
}

function PermissionNavItem({ permission, ...props }: { permission?: string; to: string; label: string; icon: React.ElementType; collapsed: boolean }) {
  const allowed = permission ? usePermission(permission) : true
  if (!allowed) return null
  return <NavItem {...props} />
}

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)
  const role = useAuthStore((s) => s.user?.role)

  if (role === 'student' || role === 'parent') {
    return (
      <aside className={cn('flex h-full flex-col bg-sidebar text-white transition-all', collapsed ? 'w-16' : 'w-64')}>
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          {!collapsed && <span className="font-semibold">Siddardha High School ERP</span>}
          <button onClick={toggle} className="rounded p-1 hover:bg-white/10"><ChevronLeft className={cn('h-5 w-5 transition', collapsed && 'rotate-180')} /></button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} collapsed={collapsed} />
        </nav>
      </aside>
    )
  }

  return (
    <aside className={cn('flex h-full flex-col bg-sidebar text-white transition-all', collapsed ? 'w-16' : 'w-64')}>
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        {!collapsed && (
          <div>
            <p className="text-xs text-slate-400">Greenfield International</p>
            <p className="font-semibold">Siddardha High School ERP</p>
          </div>
        )}
        <button onClick={toggle} className="rounded p-1 hover:bg-white/10"><ChevronLeft className={cn('h-5 w-5 transition', collapsed && 'rotate-180')} /></button>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && <p className="mb-2 px-3 text-xs uppercase tracking-wider text-slate-500">{group.label}</p>}
            <div className="space-y-1">
              {group.items.map((item) => (
                <PermissionNavItem key={item.to} {...item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
