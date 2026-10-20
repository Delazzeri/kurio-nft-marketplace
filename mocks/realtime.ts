/**
 * Servidor Socket.IO simulado: MSW intercepta o WebSocket e o
 * @mswjs/socket.io-binding faz o encode/decode do protocolo (engine.io + socket.io).
 * O app usa `socket.io-client` real — nada aqui é chamado diretamente pela UI.
 *
 * Limitações do binding (documentadas no ARCHITECTURE.md):
 *  - apenas transporte `websocket` (long-polling é HTTP e não é tratado);
 *  - handshake sintético (sid fixo, pingInterval 25 s) → enviamos ping engine.io a cada 20 s;
 *  - sem rooms/namespaces: o roteamento por usuário é feito aqui, pelo token do handshake.
 */
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { bus, db } from './db'

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.mock'

const realtime = ws.link(`${SOCKET_URL}/*`)

interface ConnectionEntry {
  close: () => void
  userId: string | null
}

const connections = new Set<ConnectionEntry>()
let blockedUntil = 0

export const realtimeControl = {
  /** Derruba todas as conexões; novas conexões são recusadas por `blockMs`. */
  disconnectAll(blockMs = 0) {
    blockedUntil = Date.now() + blockMs
    for (const c of [...connections]) c.close()
  },
  unblock() {
    blockedUntil = 0
  },
  get connectionCount() {
    return connections.size
  },
  get connectedUsers() {
    return [...connections].map((c) => c.userId)
  },
}

function userFromHandshake(raw: string): string | null {
  // pacote CONNECT do socket.io: 40{"token":"..."}
  try {
    const payload = JSON.parse(raw.slice(2)) as { token?: string }
    const session = payload.token ? db.state.sessions[payload.token] : undefined
    if (!session || session.revoked || session.expiresAt <= Date.now()) return null
    return session.userId
  } catch {
    return null
  }
}

export const realtimeHandlers = [
  realtime.addEventListener('connection', (connection) => {
    const { client } = connection
    if (Date.now() < blockedUntil) {
      client.close()
      return
    }

    const io = toSocketIo(connection)
    const entry: ConnectionEntry = { close: () => client.close(), userId: null }
    connections.add(entry)

    client.addEventListener('message', (event) => {
      if (typeof event.data === 'string' && event.data.startsWith('40')) {
        entry.userId = userFromHandshake(event.data)
      }
    })

    const unsubscribe = bus.subscribe((event) => {
      // eventos privados só vão para a conexão do dono
      if (event.type === 'order.updated' && event.userId !== entry.userId) return
      io.client.emit(event.type, event)
    })

    // mantém viva a conexão (o handshake sintético anuncia pingInterval de 25 s)
    const ping = setInterval(() => client.send('2'), 20_000)

    client.addEventListener('close', () => {
      unsubscribe()
      clearInterval(ping)
      connections.delete(entry)
    })
  }),
]
