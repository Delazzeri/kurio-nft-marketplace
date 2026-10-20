import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { ApiError, isApiError } from '@/api/errors'
import { quoteSchema, type CreateOrderInput, type Order, type Quote } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { useSession } from '@/auth/session-store'
import { storage } from '@/lib/storage'
import { eventGate } from '@/realtime/event-gate'

const attemptKey = (uid: string) => `kurio:checkout-attempt:${uid}`
const pendingKey = (uid: string) => `kurio:pending-order:${uid}`

interface Attempt {
  key: string
  fingerprint: string
}

/**
 * Chave de idempotência por TENTATIVA: o mesmo conteúdo (cotação + dados) reutiliza a chave
 * — inclusive após refresh — e um conteúdo diferente gera uma chave nova.
 */
function idempotencyKeyFor(uid: string, input: CreateOrderInput) {
  const fingerprint = JSON.stringify(input)
  const saved = storage.get<Attempt>(attemptKey(uid))
  if (saved && saved.fingerprint === fingerprint) return saved.key
  const attempt = { key: `idem_${crypto.randomUUID()}`, fingerprint }
  storage.set(attemptKey(uid), attempt)
  return attempt.key
}

export const pendingOrderStore = {
  get: (uid: string) => storage.get<string>(pendingKey(uid)),
  set: (uid: string, orderId: string) => storage.set(pendingKey(uid), orderId),
  clear: (uid: string) => storage.remove(pendingKey(uid)),
  clearAttempt: (uid: string) => storage.remove(attemptKey(uid)),
}

export class QuoteStaleError extends Error {
  constructor(public readonly quote: Quote, message: string) {
    super(message)
  }
}

const TRANSIENT = new Set(['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'])

export function useSubmitOrder() {
  const { user } = useSession()
  const client = useQueryClient()
  /** Envio em andamento: chamadas concorrentes (clique repetido) reutilizam a MESMA promessa */
  const inFlight = useRef<Promise<Order> | null>(null)

  return useMutation({
    mutationFn: async (input: CreateOrderInput): Promise<Order> => {
      if (!user) throw new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: 'Faça login para continuar.' })
      // clique repetido antes de a UI desabilitar o botão: não cria outra requisição
      if (inFlight.current) return inFlight.current
      const key = idempotencyKeyFor(user.id, input)
      const run = async (): Promise<Order> => {
        // reenvio automático só para falhas transitórias — seguro pela chave de idempotência
        for (let attempt = 0; ; attempt++) {
          try {
            return await api.orders.create(input, key)
          } catch (error) {
            if (isApiError(error) && TRANSIENT.has(error.code) && attempt < 2) continue
            if (isApiError(error) && error.code === 'QUOTE_STALE') {
              const parsed = quoteSchema.safeParse((error.details as { quote?: unknown } | undefined)?.quote)
              if (parsed.success) throw new QuoteStaleError(parsed.data, error.message)
            }
            throw error
          }
        }
      }
      inFlight.current = run().finally(() => {
        inFlight.current = null
      })
      return inFlight.current
    },
    onSuccess: (order) => {
      if (!user) return
      eventGate.observe('order', order.id, order.version)
      client.setQueryData(qk.private.order(user.id, order.id), order)
      pendingOrderStore.set(user.id, order.id)
      pendingOrderStore.clearAttempt(user.id)
    },
    onError: (error) => {
      // nova cotação → próxima confirmação será outra tentativa (nova chave)
      if (error instanceof QuoteStaleError && user) pendingOrderStore.clearAttempt(user.id)
    },
  })
}

export function useOrder(orderId: string) {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.private.order(user?.id ?? 'anon', orderId),
    queryFn: async ({ signal }) => {
      const order = await api.orders.get(orderId, { signal })
      eventGate.observe('order', order.id, order.version)
      return order
    },
    enabled: !!user,
    // fallback de polling enquanto pendente (o Socket.IO é o caminho principal)
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 4000 : false),
    retry: (count, error) => isApiError(error) && error.retryable && count < 3,
  })
}

/** Pedido pendente do usuário (recuperação após refresh/reconexão). */
export function usePendingOrder() {
  const { user } = useSession()
  return useQuery({
    queryKey: [...qk.private.orders(user?.id ?? 'anon'), 'pending'],
    queryFn: async ({ signal }) => (await api.orders.list('pending', { signal })).items[0] ?? null,
    enabled: !!user,
  })
}
