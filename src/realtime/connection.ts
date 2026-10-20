/**
 * Conexão Socket.IO + validação/aplicação dos eventos. Carregado sob demanda pelo RealtimeProvider
 * (junto com o socket.io-client, depois do MSW) — fora do bundle crítico da primeira pintura.
 */
import type { QueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import { nftUpdatedEventSchema, orderUpdatedEventSchema } from '@/api/contracts'
import { qk } from '@/api/query-keys'
import { announce } from '@/lib/announce'
import { applyNftUpdated, applyOrderUpdated } from './apply-events'
import { eventGate } from './event-gate'
import type { RealtimeStatus } from './RealtimeProvider'

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.mock'

export function openSocket(client: QueryClient, token: string | null, userId: string | null, setStatus: (s: RealtimeStatus) => void): Socket {
  const s = io(SOCKET_URL, {
    // o binding de mocks só intercepta WebSocket (sem long-polling)
    transports: ['websocket'],
    auth: token ? { token } : {},
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  })
  let everConnected = false

  s.on('connect', () => {
    setStatus('connected')
    if (everConnected) {
      // reconciliação: o que mudou enquanto estávamos fora vem do REST
      void client.invalidateQueries({ queryKey: qk.nfts.all })
      void client.invalidateQueries({ queryKey: qk.cartAll })
      void client.invalidateQueries({ queryKey: qk.quoteAll })
      if (userId) void client.invalidateQueries({ queryKey: qk.private.orders(userId) })
      announce('Conexão em tempo real restabelecida.')
    }
    everConnected = true
  })
  s.on('disconnect', (reason) => {
    // desconexão iniciada pelo cliente (troca de sessão) não é "perda de conexão"
    if (reason === 'io client disconnect') return
    setStatus('reconnecting')
  })
  s.io.on('reconnect_attempt', () => setStatus('reconnecting'))
  s.on('connect_error', () => setStatus(everConnected ? 'reconnecting' : 'offline'))

  s.on('nft.updated', (payload: unknown) => {
    const parsed = nftUpdatedEventSchema.safeParse(payload)
    if (!parsed.success) return
    if (!eventGate.admit(parsed.data).accepted) return
    applyNftUpdated(client, parsed.data)
  })
  s.on('order.updated', (payload: unknown) => {
    const parsed = orderUpdatedEventSchema.safeParse(payload)
    if (!parsed.success || parsed.data.userId !== userId) return
    if (!eventGate.admit(parsed.data).accepted) return
    applyOrderUpdated(client, parsed.data, userId)
  })
  return s
}

