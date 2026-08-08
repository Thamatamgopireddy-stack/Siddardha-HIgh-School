import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useLogin } from '@/api/hooks'
import { Monitor, Cpu } from 'lucide-react'

export function LoginPage() {
  const [isMockMode, setIsMockMode] = useState(() => {
    return localStorage.getItem('use_mock_api') === 'true'
  })
  const [email, setEmail] = useState('admin@school.edu')
  const [password, setPassword] = useState('Admin@12345')
  const navigate = useNavigate()
  const login = useLogin()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.endsWith('@gmail.com') && !email.endsWith('@school.edu')) {
      toast.error('Authentication is restricted to Gmail accounts (@gmail.com) only.')
      return
    }
    try {
      await login.mutateAsync({ email_or_phone: email, password })
      toast.success('Welcome to Siddardha High School')
      navigate('/dashboard')
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.response?.data?.error?.message || error?.response?.data?.message || 'Invalid credentials'
      toast.error(detail)
    }
  }

  const handleToggleMockMode = (checked: boolean) => {
    localStorage.setItem('use_mock_api', checked ? 'true' : 'false')
    setIsMockMode(checked)
    toast.info(checked ? 'Switched to In-Browser Demo Mode (No backend required)' : 'Switched to Live API Mode (Requires backend)')
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  const handleQuickSelect = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail)
    setPassword(rolePass)
    toast.success(`Selected credentials for ${roleEmail.split('@')[0]}`)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-primary to-sidebar p-4 overflow-hidden">
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-8 shadow-md dark:bg-slate-900">
        <div className="mb-6 text-center">
          <img 
            src="/logo.jpg" 
            alt="Siddardha High School Logo" 
            className="mx-auto mb-4 h-14 w-14 rounded-full object-cover border border-slate-100 dark:border-slate-800 shadow-sm"
          />
          <h1 className="text-2xl font-semibold text-primary">Siddardha High School</h1>
        </div>

        {/* Demo Mode Toggle */}
        <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isMockMode ? <Cpu className="h-5 w-5 text-emerald-500 animate-pulse" /> : <Monitor className="h-5 w-5 text-blue-500" />}
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {isMockMode ? "In-Browser Demo Mode" : "Live API Server"}
                </p>
                <p className="text-[10px] text-slate-400">
                  {isMockMode ? "Running completely in browser" : "Connecting to uvicorn backend"}
                </p>
              </div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={isMockMode}
                onChange={(e) => handleToggleMockMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:bg-slate-700"></div>
            </label>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Email or Phone</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800"
              required
            />
          </div>
          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-lg bg-accent py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {login.isPending ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Select Demo Roles */}
        <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
          <span className="w-full text-center text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Quick SignIn Demo Roles:</span>
          {[
            { label: 'Admin', email: 'admin@school.edu', pass: 'Admin@12345' },
            { label: 'Teacher', email: 'teacher@school.edu', pass: 'Teacher@12345' },
            { label: 'Cashier', email: 'cashier@school.edu', pass: 'Cashier@12345' },
            { label: 'Admission', email: 'admission@school.edu', pass: 'Admission@12345' },
          ].map((role) => (
            <button
              key={role.label}
              type="button"
              onClick={() => handleQuickSelect(role.email, role.pass)}
              className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-2xs font-medium text-slate-600 dark:text-slate-300 hover:border-accent hover:text-accent transition-colors"
            >
              {role.label}
            </button>
          ))}
        </div>

        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <span className="relative bg-white px-3 text-xs text-slate-400 dark:bg-slate-900">or</span>
        </div>

        <button
          onClick={() => navigate('/portal-login')}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Access via Staff Portals
        </button>

        <p className="mt-6 text-center text-xs text-slate-400">Default: admin@school.edu / Admin@12345</p>
      </div>
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
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  )
}

