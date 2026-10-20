import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { SessionWatcher } from '@/auth/SessionWatcher'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { LiveRegion, NotFound } from '@/components/states'
import { Toaster } from '@/components/ui/sonner'

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
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])
  return mainRef
}

function RootLayout() {
  const mainRef = useFocusOnNavigate()
  // telas de autenticação no mobile são tela cheia (frames mobile de Login/Cadastro)
  const authScreen = useRouterState({ select: (s) => s.matches.some((m) => m.staticData?.authScreen) })
  return (
    <>
      <HeadContent />
      <a href="#conteudo" className="sr-only z-50 rounded-sm bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      <div className={authScreen ? 'max-md:hidden' : undefined}>
        <Header />
      </div>
      <main id="conteudo" ref={mainRef} tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <div className={authScreen ? 'max-md:hidden' : undefined}>
        <Footer />
      </div>
      <Toaster />
      <LiveRegion />
      <SessionWatcher />
      <Suspense>
        <MockPanel />
      </Suspense>
    </>
  )
}
