import type { LoginInput, RegisterInput, Session, User } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { isApiError } from '@/api/client'
import { qk } from '@/api/query-keys'
import { queryClient } from '@/app/query-client'
import { guestCart, sessionStore } from './session-store'

let verifying: Promise<User | null> | null = null

/** Ao encerrar/trocar sessão: remove todo dado privado e o carrinho/cotação do usuário anterior. */
sessionStore.onEnd(() => {
  verifying = null
  void queryClient.cancelQueries({ queryKey: qk.private.all })
  queryClient.removeQueries({ queryKey: qk.private.all })
  queryClient.removeQueries({ queryKey: qk.cartAll })
  queryClient.removeQueries({ queryKey: qk.quoteAll })
})

async function afterAuthentication(session: Session) {
  const guestId = guestCart.id()
  sessionStore.start(session)
  // preserva os itens do visitante: mescla no carrinho do usuário
  try {
    const merged = await api.cart.merge(guestId)
    // um GET do carrinho iniciado antes da mescla não pode sobrescrever o resultado (corrida)
    await queryClient.cancelQueries({ queryKey: qk.cart(session.user.id) })
    queryClient.setQueryData(qk.cart(session.user.id), merged)
  } catch {
    void queryClient.invalidateQueries({ queryKey: qk.cartAll })
  }
  guestCart.rotate()
  queryClient.removeQueries({ queryKey: qk.cart(guestId) })
  queryClient.removeQueries({ queryKey: qk.quoteAll })
}

export const authService = {
  /** Confirma a sessão persistida (uma vez por carregamento). */
  ensureSession(): Promise<User | null> {
    const s = sessionStore.get()
    if (s.status === 'anonymous') return Promise.resolve(null)
    if (s.status === 'authenticated') return Promise.resolve(s.user)
    verifying ??= api.auth
      .session()
      .then((session) => {
        sessionStore.verify(session)
        return session.user
      })
      .catch((error) => {
        verifying = null
        // offline: mantém a sessão persistida; 401 já encerrou a sessão no interceptor
        if (isApiError(error) && error.status === 0) return sessionStore.get().user
        if (sessionStore.get().status !== 'anonymous') sessionStore.end('expired')
        return null
      })
    return verifying
  },
  async login(input: LoginInput) {
    const session = await api.auth.login(input)
    await afterAuthentication(session)
    return session.user
  },
  async register(input: RegisterInput) {
    const session = await api.auth.register(input)
    await afterAuthentication(session)
    return session.user
  },
  async logout() {
    try {
      await api.auth.logout()
    } catch {
      /* encerra localmente mesmo se a API falhar */
    } finally {
      sessionStore.end('logout')
    }
  },
}
