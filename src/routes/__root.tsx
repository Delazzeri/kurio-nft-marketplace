import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { SessionWatcher } from '@/auth/SessionWatcher'
import { Footer } from '@/components/layout/Footer'
import { MobileTabBar } from '@/components/layout/MobileNav'
import { LiveRegion, NotFound } from '@/components/states'
import { useAfterLoadIdle } from '@/lib/idle'
import { useIsDesktop } from '@/lib/use-media'

const Toaster = lazy(() => import('@/components/ui/sonner').then((m) => ({ default: m.Toaster })))

// header só existe no desktop: carregado sob demanda (fora do bundle crítico do mobile)
const Header = lazy(() => import('@/components/layout/Header').then((m) => ({ default: m.Header })))

const MockPanel = import.meta.env.VITE_ENABLE_MOCKS !== 'false' ? lazy(() => import('@mocks/MockPanel')) : () => null

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: () => <NotFound />,
})

/** Move o foco para o conteúdo principal a cada navegação (leitores de tela). */
function useFocusOnNavigate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const mainRef = useRef<HTMLElement>(null)
  // compara com o pathname anterior (e não com um flag de "primeira vez", que o StrictMode quebra)
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])
  return mainRef
}

function RootLayout() {
  const mainRef = useFocusOnNavigate()
  // telas de autenticação no mobile são tela cheia (frames mobile de Login/Cadastro)
  const authScreen = useRouterState({ select: (s) => s.matches.some((m) => m.staticData?.authScreen) })
  const isDesktop = useIsDesktop()
  // toasts e painel de mocks só depois da primeira tela (não disputam a thread com o LCP)
  const deferredReady = useAfterLoadIdle()
  const showTabs = useRouterState({ select: (s) => !s.matches.some((m) => m.staticData?.authScreen || m.staticData?.hideMobileTabs) })
  return (
    <>
      <HeadContent />
      <a href="#conteudo" className="sr-only z-50 rounded-sm bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      {/* no mobile cada tela tem seu topo (frames mobile); header completo a partir de md */}
      {isDesktop && (
        <Suspense fallback={<div aria-hidden className="container-page h-[68px]" />}>
          <Header />
        </Suspense>
      )}
      {/* altura mínima de uma tela: o footer não aparece (e não é empurrado) enquanto o conteúdo carrega — evita CLS */}
      <main id="conteudo" ref={mainRef} tabIndex={-1} className="min-h-dvh outline-none">
        <Outlet />
      </main>
      {(isDesktop || !authScreen) && <Footer />}
      {showTabs && !isDesktop && (
        <>
          <div aria-hidden className="h-28" />
          <MobileTabBar />
        </>
      )}
      {deferredReady && (
        <Suspense>
          <Toaster />
        </Suspense>
      )}
      <LiveRegion />
      <SessionWatcher />
      {deferredReady && (
        <Suspense>
          <MockPanel />
        </Suspense>
      )}
    </>
  )
}
