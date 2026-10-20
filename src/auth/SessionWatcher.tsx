import { useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { announce } from '@/lib/announce'
import { sessionStore, useSession } from './session-store'

const PRIVATE_PREFIXES = ['/pagamento', '/perfil', '/pedidos']

/**
 * Reage ao fim da sessão (expiração detectada por 401 ou pelo relógio):
 * em rota privada, leva ao login preservando o destino para retomada.
 */
export function SessionWatcher() {
  const navigate = useNavigate()
  const router = useRouter()
  const { status, expiresAt } = useSession()

  // confirma sessão persistida ao carregar
  useEffect(() => {
    // serviço de auth (e camada HTTP) carregado sob demanda — fora do bundle da primeira pintura
    void import('./auth-service').then(({ authService }) => authService.ensureSession())
  }, [])

  useEffect(() => {
    const unsubscribe = sessionStore.onEnd((reason) => {
        const { pathname, href } = router.state.location
        if (reason !== 'expired') return
        const message = 'Sua sessão expirou. Entre novamente para continuar de onde parou.'
        void import('sonner').then(({ toast }) => toast.warning(message, { id: 'session-expired' }))
        announce(message, 'assertive')
        if (PRIVATE_PREFIXES.some((p) => pathname.startsWith(p))) {
          void navigate({ to: '/entrar', search: { redirect: href, motivo: 'expirada' }, replace: true })
        }
    })
    return () => {
      unsubscribe()
    }
  }, [navigate, router])

  // expiração durante a navegação: ao vencer o prazo, a API confirma (401 encerra a sessão)
  useEffect(() => {
    if (status !== 'authenticated' || !expiresAt) return
    const ms = Date.parse(expiresAt) - Date.now()
    const timer = window.setTimeout(() => void import('@/api/endpoints').then(({ api }) => api.auth.session().catch(() => undefined)), Math.max(0, ms) + 250)
    return () => window.clearTimeout(timer)
  }, [status, expiresAt])

  return null
}
