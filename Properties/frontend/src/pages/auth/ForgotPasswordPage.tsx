import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/api/client'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      toast.success('If the account exists, an OTP has been sent.')
      // Route to reset password with email carried forward in state
      navigate('/reset-password', { state: { email } })
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-primary to-sidebar p-4 overflow-hidden">
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-8 shadow-md dark:bg-slate-900">
        <div className="mb-8 text-center">
          <img 
            src="/logo.jpg" 
            alt="Siddardha High School Logo" 
            className="mx-auto mb-4 h-14 w-14 rounded-full object-cover border border-slate-100 dark:border-slate-800 shadow-sm"
          />
          <h1 className="text-2xl font-semibold text-primary">Forgot Password?</h1>
          <p className="mt-1 text-sm text-slate-500">Provide your registered email to receive a recovery OTP.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-accent py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Requesting OTP...' : 'Send OTP'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs">
          <Link to="/login" className="text-accent hover:underline">Back to Login</Link>
        </p>
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
