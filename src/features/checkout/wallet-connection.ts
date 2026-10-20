import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { isApiError } from '@/api/errors'
import type { NetworkId, WalletSession, WalletType } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { useSession } from '@/auth/session-store'
import { announce } from '@/lib/announce'

const key = (uid: string) => `kurio:wallet-session:${uid}`

function readSaved(uid: string | undefined): WalletSession | null {
  if (!uid) return null
  try {
    const raw = sessionStorage.getItem(key(uid))
    return raw ? (JSON.parse(raw) as WalletSession) : null
  } catch {
    return null
  }
}

export function useWallets() {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.private.wallets(user?.id ?? 'anon'),
    queryFn: ({ signal }) => api.wallets.get({ signal }),
    enabled: !!user,
  })
}

/** Conexão simulada de carteira via API: conectar, recusa (cenário) e desconectar. */
export function useWalletConnection() {
  const { user } = useSession()
  const [session, setSession] = useState<WalletSession | null>(() => readSaved(user?.id))

  const persist = (s: WalletSession | null) => {
    setSession(s)
    if (!user) return
    try {
      if (s) sessionStorage.setItem(key(user.id), JSON.stringify(s))
      else sessionStorage.removeItem(key(user.id))
    } catch {
      /* noop */
    }
  }

  const connect = useMutation({
    mutationFn: ({ walletId, network, provider }: { walletId: string; network: NetworkId; provider: WalletType }) =>
      api.walletSessions.connect(walletId, network, provider),
    onSuccess: (s) => {
      persist(s)
      announce(`Carteira conectada via ${s.provider}.`)
    },
    onError: (error) => {
      const message = isApiError(error) ? error.message : 'Não foi possível conectar a carteira.'
      toast.error(message)
      announce(message, 'assertive')
    },
  })

  const disconnect = useMutation({
    mutationFn: async () => {
      if (session) await api.walletSessions.disconnect(session.id).catch(() => undefined)
    },
    onSettled: () => {
      persist(null)
      announce('Carteira desconectada.')
    },
  })

  return { session, connect, disconnect, reset: () => persist(null) }
}
