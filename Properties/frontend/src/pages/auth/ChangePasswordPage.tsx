import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { api } from '@/api/client'

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    setIsLoading(true)
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      toast.success('Password changed successfully')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to change password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <PageWrapper title="Change Password" description="Update your login password to maintain account security.">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-accent py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </PageWrapper>
  )
}
