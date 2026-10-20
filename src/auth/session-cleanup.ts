/**
 * Ao encerrar/trocar sessão: remove todo dado privado e o carrinho/cotação do usuário anterior.
 * Módulo leve, importado pelo App desde o início — a limpeza nunca depende do carregamento
 * tardio do serviço de autenticação.
 */
import { qk } from '@/api/query-keys'
import { queryClient } from '@/app/query-client'
import { sessionStore } from './session-store'

sessionStore.onEnd(() => {
  void queryClient.cancelQueries({ queryKey: qk.private.all })
  queryClient.removeQueries({ queryKey: qk.private.all })
  queryClient.removeQueries({ queryKey: qk.cartAll })
  queryClient.removeQueries({ queryKey: qk.quoteAll })
})
