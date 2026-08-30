import { useAuthStore } from '@/store'

export function usePermission(permission: string) {
  const permissions = useAuthStore((s) => s.permissions)
  const role = useAuthStore((s) => s.user?.role)
  if (role === 'super_admin' || role === 'developer') return true
  return permissions.includes(permission)
}
