import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export function connectSocket(auth: Record<string, unknown>): Socket {
  socket?.close()
  // Polling first: some shared-hosting reverse proxies (Passenger/cPanel included) never
  // cleanly reject a WebSocket upgrade attempt, they just hang until the connection times
  // out — which made realtime look completely dead instead of falling back quickly. Plain
  // HTTP long-polling works through virtually any proxy, so it's the safer default; the
  // client still upgrades to a real WebSocket afterwards when the environment supports it.
  socket = io({ auth, transports: ['polling', 'websocket'] })
  return socket
}

export function disconnectSocket(): void {
  socket?.close()
  socket = null
}
