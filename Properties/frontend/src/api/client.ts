import axios from 'axios'
import { useAuthStore } from '@/store'
import { mockAdapter } from './mockDb'

export const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://127.0.0.1:8000'
    : typeof window !== 'undefined'
    ? window.location.origin
    : 'http://127.0.0.1:8000')

// Default use_mock_api to 'false' so all clients connect to central database dynamically
if (typeof window !== 'undefined' && localStorage.getItem('use_mock_api') === null) {
  localStorage.setItem('use_mock_api', 'false')
}

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const isMock = typeof window !== 'undefined' && localStorage.getItem('use_mock_api') === 'true'
  if (isMock) {
    config.adapter = mockAdapter
  }
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
          const isMock = typeof window !== 'undefined' && localStorage.getItem('use_mock_api') === 'true'
          const { data } = await axios.post(
            `${API_URL}/api/v1/auth/refresh`,
            { refresh_token: refreshToken },
            { adapter: isMock ? mockAdapter : undefined }
          )
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
