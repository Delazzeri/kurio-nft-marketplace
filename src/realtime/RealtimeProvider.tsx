import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { mocksReady } from '@/app/mocks-ready'
import { afterLoadIdle } from '@/lib/idle'
import { useSession } from '@/auth/session-store'

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

const RealtimeContext = createContext<{ status: RealtimeStatus }>({ status: 'connecting' })

/**
 * Uma conexão Socket.IO por sessão: ao trocar de token (login/logout/troca de usuário) a conexão
 * anterior é encerrada e seus listeners liberados — eventos da sessão anterior não chegam à nova.
 * O socket.io-client é carregado sob demanda (fora do bundle crítico).
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const { token, user } = useSession()
  const userId = user?.id ?? null
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    let socket: Socket | null = null
    let disposed = false
    // socket.io-client só depois do MSW: o engine.io-client captura globalThis.WebSocket ao carregar
    void mocksReady
      .then(() => afterLoadIdle)
      .then(() => import('./connection'))
      .then(({ openSocket }) => {
        if (!disposed) socket = openSocket(client, token, userId, setStatus)
      })
    return () => {
      disposed = true
      socket?.removeAllListeners()
      socket?.io.removeAllListeners()
      socket?.disconnect()
    }
  }, [client, token, userId])

  return <RealtimeContext.Provider value={{ status }}>{children}</RealtimeContext.Provider>
}

export function useRealtime() {
  return useContext(RealtimeContext)
}
