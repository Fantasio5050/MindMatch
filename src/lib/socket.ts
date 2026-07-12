import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export function connectSocket(auth: Record<string, unknown>): Socket {
  socket?.close()
  socket = io({ auth, transports: ['websocket', 'polling'] })
  return socket
}

export function disconnectSocket(): void {
  socket?.close()
  socket = null
}
