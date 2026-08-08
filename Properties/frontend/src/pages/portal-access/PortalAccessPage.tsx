import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Wallet, DoorOpen, UserCog, GraduationCap, ArrowLeft, ShieldCheck, RefreshCw, UserPlus } from 'lucide-react'
import { useLogin } from '@/api/hooks'
import { useAuthStore } from '@/store'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { api } from '@/api/client'

type PortalType = 'cashier' | 'admission' | 'management' | 'teachers'

const portalConfigs = {
  cashier: {
    title: 'Cashier Portal',
    description: 'Manage fees, billing, invoices, and payments',
    icon: Wallet,
    gradient: 'from-blue-600 to-cyan-500',
    hoverShadow: 'hover:shadow-blue-500/20',
    allowedRoles: ['accountant'],
  },
  admission: {
    title: 'Admission Portal',
    description: 'Process registrations, review documents, and manage enrollments',
    icon: DoorOpen,
    gradient: 'from-emerald-600 to-teal-500',
    hoverShadow: 'hover:shadow-emerald-500/20',
    allowedRoles: ['school_admin', 'super_admin'],
  },
  management: {
    title: 'Management Portal',
    description: 'Oversee school administration, developer panel, and settings',
    icon: UserCog,
    gradient: 'from-violet-600 to-purple-500',
    hoverShadow: 'hover:shadow-violet-500/20',
    allowedRoles: ['school_admin', 'super_admin', 'developer', 'principal'],
  },
  teachers: {
    title: 'Teachers Portal',
    description: 'Track classes, mark attendance, and manage student LMS',
    icon: GraduationCap,
    gradient: 'from-amber-600 to-orange-500',
    hoverShadow: 'hover:shadow-amber-500/20',
    allowedRoles: ['teacher', 'class_teacher'],
  },
}

export function PortalAccessPage() {
  const navigate = useNavigate()
  const login = useLogin()
  const { user, logout } = useAuthStore()

  const [selectedPortal, setSelectedPortal] = useState<PortalType | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // New staff onboarding form states
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'accountant' | 'school_admin_admission' | 'school_admin_mgmt' | 'teacher'>('teacher')
  const [newEmpId, setNewEmpId] = useState(`EMP-${Math.floor(1000 + Math.random() * 9000)}`)
  const [newDept, setNewDept] = useState('Academic')
  const [onboardLoading, setOnboardLoading] = useState(false)

  const handlePortalSelect = (portal: PortalType) => {
    setSelectedPortal(portal)
    // Clear inputs and set convenient seed defaults to help testing
    if (portal === 'cashier') {
      setEmail('cashier@school.edu')
      setPassword('Cashier@12345')
    } else if (portal === 'admission') {
      setEmail('admission@school.edu')
      setPassword('Admission@12345')
    } else if (portal === 'management') {
      setEmail('admin@school.edu')
      setPassword('Admin@12345')
    } else if (portal === 'teachers') {
      setEmail('teacher@school.edu')
      setPassword('Teacher@12345')
    } else {
      setEmail('')
      setPassword('')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPortal) return

    // Enforce login via Gmail only (allowing @school.edu for seed credentials)
    if (!email.endsWith('@gmail.com') && !email.endsWith('@school.edu')) {
      toast.error('Authentication is restricted to Gmail accounts (@gmail.com) only.')
      return
    }

    try {
      const config = portalConfigs[selectedPortal]
      const result = await login.mutateAsync({ email_or_phone: email, password })
      const userRole = result.user.role

      if (!config.allowedRoles.includes(userRole)) {
        // Logout immediately and show authorization error
        logout()
        toast.error(`Access Denied: This account does not have authorization for the ${config.title}.`)
        return
      }

      toast.success(`Access Granted: Logged in to the ${config.title}`)
      navigate('/dashboard')
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.response?.data?.error?.message || error?.response?.data?.message || 'Invalid credentials'
      toast.error(detail)
    }
  }

  const handleRoleChange = (role: 'accountant' | 'school_admin_admission' | 'school_admin_mgmt' | 'teacher') => {
    setNewRole(role)
    if (role === 'accountant') {
      setNewDept('Accounts')
    } else if (role === 'school_admin_admission') {
      setNewDept('Admissions')
    } else if (role === 'school_admin_mgmt') {
      setNewDept('Administration')
    } else if (role === 'teacher') {
      setNewDept('Academic')
    }
  }

  const handleOnboardStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.endsWith('@gmail.com')) {
      toast.error('Onboarding error: Email must be a valid @gmail.com address.')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Onboarding error: Password must be at least 6 characters.')
      return
    }

    setOnboardLoading(true)
    try {
      const backendRole = newRole === 'school_admin_admission' || newRole === 'school_admin_mgmt' 
        ? 'school_admin' 
        : newRole

      await api.post('/hr/staff', {
        email: newEmail,
        first_name: newFirstName,
        last_name: newLastName,
        employee_id: newEmpId,
        department: newDept,
        role: backendRole,
        password: newPassword,
      })

      toast.success(`Successfully onboarded staff member ${newFirstName} ${newLastName}!`)
      
      // Reset form
      setNewFirstName('')
      setNewLastName('')
      setNewEmail('')
      setNewPassword('')
      setNewEmpId(`EMP-${Math.floor(1000 + Math.random() * 9000)}`)
    } catch (error: any) {
      const detail = error?.response?.data?.detail || 'Failed to onboard staff member'
      toast.error(detail)
    } finally {
      setOnboardLoading(false)
    }
  }

  // Get current portal information based on active user role
  const getActivePortal = (): string => {
    if (!user) return ''
    const role = user.role
    if (role === 'accountant') return 'Cashier Portal'
    if (['teacher', 'class_teacher'].includes(role)) return 'Teachers Portal'
    if (['school_admin', 'super_admin', 'developer', 'principal'].includes(role)) return 'Management / Admission Portal'
    return 'General Portal'
  }

  const isAdmin = user && ['school_admin', 'super_admin', 'developer', 'principal'].includes(user.role)

  // Render the internal dashboard wrapper view if the user is already logged in
  if (user) {
    return (
      <PageWrapper title="Portal Access" description="Choose or switch between staff portals">
        <div className="space-y-8">
          {/* Current Active Portal Status */}
          <div className="flex items-center gap-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-6 dark:border-emerald-950 dark:bg-emerald-950/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Currently Authenticated</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You are active in the <span className="font-semibold text-emerald-600 dark:text-emerald-400">{getActivePortal()}</span> as <span className="font-semibold">{user.first_name} {user.last_name}</span> ({user.email}).
              </p>
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-white">Switch to Another Portal</h2>
            
            {selectedPortal ? (
              <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 transition-all duration-300 animate-in fade-in zoom-in-95">
                <button 
                  onClick={() => setSelectedPortal(null)}
                  className="mb-4 flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Selection
                </button>
                
                <div className="mb-6 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${portalConfigs[selectedPortal].gradient} text-white`}>
                    {(() => {
                      const Icon = portalConfigs[selectedPortal].icon
                      return <Icon className="h-5 w-5" />
                    })()}
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-slate-800 dark:text-white">
                      Switch to {portalConfigs[selectedPortal].title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Enter the portal credentials. You will be logged out of your current session.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Gmail ID</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@gmail.com"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Password</label>
                    <input
                      type="password"
                      value={password}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={login.isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {login.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Switching Portals...
                      </>
                    ) : (
                      'Authenticate & Switch'
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {(Object.keys(portalConfigs) as PortalType[]).map((key) => {
                  const config = portalConfigs[key]
                  const Icon = config.icon
                  return (
                    <button
                      key={key}
                      onClick={() => handlePortalSelect(key)}
                      className={`flex flex-col items-start text-left rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 ${config.hoverShadow}`}
                    >
                      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${config.gradient} text-white shadow-sm`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mb-1 font-semibold text-slate-800 dark:text-white">{config.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{config.description}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Add Staff Section (Admins Only) */}
          {isAdmin && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Register New Staff Member</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Add a new staff member with a Gmail account to grant them login access to their specific portal.
                  </p>
                </div>
              </div>

              <form onSubmit={handleOnboardStaff} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">First Name</label>
                    <input
                      type="text"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="e.g. John"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">Last Name</label>
                    <input
                      type="text"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      placeholder="e.g. Doe"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">Gmail ID</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="username@gmail.com"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      required
                    />
                    <p className="mt-1 text-2xs text-slate-400">Must end in @gmail.com for security compliance.</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">Portal / Role Category</label>
                    <select
                      value={newRole}
                      onChange={(e) => handleRoleChange(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="teacher">Teachers Portal (Teacher)</option>
                      <option value="accountant">Cashier Portal (Accountant)</option>
                      <option value="school_admin_admission">Admission Portal (School Admin)</option>
                      <option value="school_admin_mgmt">Management Portal (School Admin)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">Employee ID</label>
                      <input
                        type="text"
                        value={newEmpId}
                        onChange={(e) => setNewEmpId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">Department</label>
                      <input
                        type="text"
                        value={newDept}
                        onChange={(e) => setNewDept(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={onboardLoading}
                    className="w-full md:w-auto flex items-center justify-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow-md"
                  >
                    {onboardLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Adding Staff...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" /> Add Staff Member
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </PageWrapper>
    )
  }

  // Render the public login view if the user is not logged in
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-primary to-sidebar p-4 overflow-hidden dark:bg-slate-950">
      {/* Dynamic light blur rings */}
      <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-4xl rounded-2xl border border-white/10 bg-white/70 p-6 md:p-10 shadow-2xl backdrop-blur-xl dark:bg-slate-900/80">
        
        {/* Back Link */}
        <button 
          onClick={() => navigate('/login')}
          className="absolute left-6 top-6 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Standard Sign In
        </button>

        {/* Title */}
        <div className="mb-8 mt-4 text-center">
          <img 
            src="/logo.jpg" 
            alt="Siddardha High School Logo" 
            className="mx-auto mb-4 h-16 w-16 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-md"
          />
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-300">
            Siddardha High School
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Unified Staff Portal Gateway
          </p>
        </div>

        {/* Form or Portal Grid */}
        {selectedPortal ? (
          <div className="mx-auto max-w-md rounded-xl border border-slate-200/50 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900 transition-all duration-300 animate-in fade-in zoom-in-95">
            <button 
              onClick={() => setSelectedPortal(null)}
              className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Portal Selection
            </button>
            
            <div className="mb-6 flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${portalConfigs[selectedPortal].gradient} text-white shadow-md shadow-blue-500/10`}>
                {(() => {
                  const Icon = portalConfigs[selectedPortal].icon
                  return <Icon className="h-6 w-6" />
                })()}
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-800 dark:text-white">
                  {portalConfigs[selectedPortal].title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Authenticating user access for {portalConfigs[selectedPortal].description.toLowerCase()}
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Gmail ID
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staffname@gmail.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
                <p className="mt-1 text-2xs text-slate-400">Must end with @gmail.com</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={login.isPending}
                className={`w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r ${portalConfigs[selectedPortal].gradient} py-2.5 text-sm font-bold text-white shadow-lg hover:brightness-105 disabled:opacity-50`}
              >
                {login.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Verifying Credentials...
                  </>
                ) : (
                  'Sign In to Portal'
                )}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <p className="mb-6 text-center text-sm font-medium text-slate-600 dark:text-slate-400">
              Please choose a portal to sign in:
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(portalConfigs) as PortalType[]).map((key) => {
                const config = portalConfigs[key]
                const Icon = config.icon
                return (
                  <button
                    key={key}
                    onClick={() => handlePortalSelect(key)}
                    className={`group flex flex-col items-start text-left rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:bg-white dark:border-slate-800/80 dark:bg-slate-900/50 dark:hover:bg-slate-900 ${config.hoverShadow}`}
                  >
                    <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${config.gradient} text-white shadow-md shadow-blue-500/10 group-hover:scale-105 transition-transform duration-300`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 font-bold text-slate-800 dark:text-white text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {config.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {config.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Overlay Watermark Background Logo */}
      <div 
        className="pointer-events-none absolute z-0 opacity-[0.05] dark:opacity-[0.02]"
        style={{ 
          backgroundImage: 'url("/logo.jpg")',
          backgroundSize: 'cover',
          width: 'min(90vw, 900px)',
          height: 'min(90vw, 900px)',
          borderRadius: '50%',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  )
}
