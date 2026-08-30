import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { usePermission } from '@/hooks/usePermission'

export function ProtectedRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const token = useAuthStore((s) => s.accessToken)
  const allowed = permission ? usePermission(permission) : true

  if (!token) return <Navigate to="/login" replace />
  if (permission && !allowed) return <Navigate to="/403" replace />
  return <>{children}</>
}
