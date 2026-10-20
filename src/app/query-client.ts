import { MutationCache, QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/client'

/**
 * Política de cache (documentada no ARCHITECTURE.md):
 * - staleTime 30 s para dados públicos; eventos Socket.IO mantêm preço/disponibilidade frescos.
 * - retry automático só para consultas e só para falhas transitórias (rede, timeout, 5xx), até 2x
 *   com backoff exponencial. 4xx nunca é repetido.
 * - mutations NUNCA repetem automaticamente (evita operações duplicadas); pedidos usam chave de
 *   idempotência e o reenvio é explícito.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => isApiError(error) && error.retryable && failureCount < 2,
      retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
  mutationCache: new MutationCache(),
})
