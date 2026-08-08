import { toast } from 'sonner'

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

type EventCallback = (data: any) => void

class RealTimeSocketService {
  private socket: WebSocket | null = null
  private listeners: Map<string, Set<EventCallback>> = new Map()
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set()
  private reconnectTimer: any = null
  private currentStatus: ConnectionStatus = 'disconnected'

  public get status(): ConnectionStatus {
    return this.currentStatus
  }

  private setStatus(status: ConnectionStatus) {
    this.currentStatus = status
    this.statusListeners.forEach((listener) => listener(status))
  }

  public onStatusChange(callback: (status: ConnectionStatus) => void) {
    this.statusListeners.add(callback)
    callback(this.currentStatus)
    return () => {
      this.statusListeners.delete(callback)
    }
  }

  public connect(token?: string) {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.setStatus('connecting')

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // If running on vite dev server (port 5173), target backend port 8000
    const host = window.location.port === '5173' ? `${window.location.hostname}:8000` : window.location.host
    const wsUrl = `${protocol}//${host}/api/v1/ws${token ? `?token=${token}` : ''}`

    try {
      this.socket = new WebSocket(wsUrl)

      this.socket.onopen = () => {
        this.setStatus('connected')
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
      }

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          const { type, data } = payload

          if (type === 'new_message') {
            toast.info(`🔔 Message: ${data.title}`, {
              description: data.body,
              duration: 5000,
            })
          } else if (type === 'new_notice') {
            toast.success(`📢 Notice Board: ${data.title}`, {
              description: data.content,
              duration: 6000,
            })
          }

          // Trigger subscribers
          const callbacks = this.listeners.get(type)
          if (callbacks) {
            callbacks.forEach((cb) => cb(data))
          }
        } catch {
          // ignore non-JSON
        }
      }

      this.socket.onclose = () => {
        this.setStatus('disconnected')
        this.scheduleReconnect(token)
      }

      this.socket.onerror = () => {
        this.setStatus('disconnected')
        this.socket?.close()
      }
    } catch {
      this.setStatus('disconnected')
      this.scheduleReconnect(token)
    }
  }

  private scheduleReconnect(token?: string) {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect(token)
    }, 5000)
  }

  public subscribe(eventType: string, callback: EventCallback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)?.add(callback)
    return () => this.listeners.get(eventType)?.delete(callback)
  }

  public send(type: string, data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, ...data }))
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.setStatus('disconnected')
  }
}

export const socketService = new RealTimeSocketService()
