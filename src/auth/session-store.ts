/**
 * Store de sessão (fora do React) — lido pelo Axios, pelo Router (guards) e pela UI.
 * Persistência: token + usuário em localStorage para recuperar a sessão após refresh;
 * a validade é sempre confirmada em GET /auth/session antes de liberar rotas privadas.
 */
import { useSyncExternalStore } from 'react'
import type { Session, User } from '@/api/contracts'
import { storage } from '@/lib/storage'

const SESSION_KEY = 'kurio:session'
const GUEST_CART_KEY = 'kurio:guest-cart'

export type SessionStatus = 'anonymous' | 'unverified' | 'authenticated'
export type SessionEndReason = 'logout' | 'expired' | 'switch'

export interface SessionState {
  status: SessionStatus
  token: string | null
  user: User | null
  expiresAt: string | null
  /** Motivo do último encerramento (exibido na tela de login) */
  endedBy: SessionEndReason | null
}

type Listener = () => void
type EndListener = (reason: SessionEndReason, previousUserId: string | null) => void

const persisted = storage.get<Session>(SESSION_KEY)

let state: SessionState = persisted
  ? { status: 'unverified', token: persisted.token, user: persisted.user, expiresAt: persisted.expiresAt, endedBy: null }
  : { status: 'anonymous', token: null, user: null, expiresAt: null, endedBy: null }

const listeners = new Set<Listener>()
const endListeners = new Set<EndListener>()

function set(next: SessionState) {
  state = next
  listeners.forEach((l) => l())
}

export const sessionStore = {
  get: () => state,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  /** Disparado ao encerrar a sessão — limpa caches privados e subscriptions. */
  onEnd(listener: EndListener) {
    endListeners.add(listener)
    return () => endListeners.delete(listener)
  },
  start(session: Session) {
    const previous = state.user?.id ?? null
    if (previous && previous !== session.user.id) endListeners.forEach((l) => l('switch', previous))
    storage.set(SESSION_KEY, session)
    set({ status: 'authenticated', token: session.token, user: session.user, expiresAt: session.expiresAt, endedBy: null })
  },
  verify(session: Session) {
    storage.set(SESSION_KEY, session)
    set({ status: 'authenticated', token: session.token, user: session.user, expiresAt: session.expiresAt, endedBy: null })
  },
  updateUser(patch: Partial<User>) {
    if (!state.user) return
    const user = { ...state.user, ...patch }
    const persistedSession = storage.get<Session>(SESSION_KEY)
    if (persistedSession) storage.set(SESSION_KEY, { ...persistedSession, user })
    set({ ...state, user })
  },
  end(reason: SessionEndReason) {
    if (state.status === 'anonymous' && !state.token) return
    const previous = state.user?.id ?? null
    storage.remove(SESSION_KEY)
    set({ status: 'anonymous', token: null, user: null, expiresAt: null, endedBy: reason })
    endListeners.forEach((l) => l(reason, previous))
  },
  clearEndReason() {
    if (state.endedBy) set({ ...state, endedBy: null })
  },
}

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

/** Id do carrinho do visitante (gerado no primeiro uso, trocado após mesclar no login). */
export const guestCart = {
  id(): string {
    let id = storage.get<string>(GUEST_CART_KEY)
    if (!id) {
      id = `gc_${crypto.randomUUID()}`
      storage.set(GUEST_CART_KEY, id)
    }
    return id
  },
  rotate() {
    const id = `gc_${crypto.randomUUID()}`
    storage.set(GUEST_CART_KEY, id)
    return id
  },
}
