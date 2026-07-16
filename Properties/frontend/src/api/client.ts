import axios from 'axios'
import { useAuthStore } from '@/store'

export const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://127.0.0.1:8000' : window.location.origin)

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = useAuthStore.getState().refreshToken
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refresh_token: refreshToken })
          const payload = data.data
          useAuthStore.getState().setAuth(
            useAuthStore.getState().user!,
            payload.access_token,
            payload.refresh_token
          )
          original.headers.Authorization = `Bearer ${payload.access_token}`
          return api(original)
        } catch {
          useAuthStore.getState().logout()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)
