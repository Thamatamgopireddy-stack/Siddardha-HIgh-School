import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast, Toaster } from 'sonner'
import { useLogin } from '@/api/hooks'

export function LoginPage() {
  const [email, setEmail] = useState('admin@school.edu')
  const [password, setPassword] = useState('Admin@12345')
  const navigate = useNavigate()
  const login = useLogin()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login.mutateAsync({ email_or_phone: email, password })
      toast.success('Welcome to Siddardha High School ERP')
      navigate('/dashboard')
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.response?.data?.error?.message || error?.response?.data?.message || 'Invalid credentials'
      toast.error(detail)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary to-sidebar p-4">
      <Toaster position="top-right" />
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md dark:bg-slate-900">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white">S</div>
          <h1 className="text-2xl font-semibold text-primary">Siddardha High School ERP</h1>
          <p className="mt-1 text-sm text-slate-500">Greenfield International School · CBSE</p>
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
        <p className="mt-6 text-center text-xs text-slate-400">Default: admin@school.edu / Admin@12345</p>
      </div>
    </div>
  )
}
