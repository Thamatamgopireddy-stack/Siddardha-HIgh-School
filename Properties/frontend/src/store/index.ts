import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  permissions: string[]
  setAuth: (user: User, accessToken: string, refreshToken: string, permissions?: string[]) => void
  setPermissions: (permissions: string[]) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      permissions: [],
      setAuth: (user, accessToken, refreshToken, permissions = []) =>
        set({ user, accessToken, refreshToken, permissions }),
      setPermissions: (permissions) => set({ permissions }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null, permissions: [] }),
    }),
    { name: 'siddardha-auth' }
  )
)

interface UIState {
  sidebarCollapsed: boolean
  darkMode: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  toggleDarkMode: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      darkMode: false,
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleDarkMode: () => {
        const darkMode = !get().darkMode
        document.documentElement.classList.toggle('dark', darkMode)
        set({ darkMode })
      },
    }),
    { name: 'siddardha-ui' }
  )
)
