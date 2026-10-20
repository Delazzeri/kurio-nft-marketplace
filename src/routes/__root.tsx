import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { SessionWatcher } from '@/auth/SessionWatcher'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { MobileTabBar } from '@/components/layout/MobileNav'
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
  const showTabs = useRouterState({ select: (s) => !s.matches.some((m) => m.staticData?.authScreen || m.staticData?.hideMobileTabs) })
  return (
    <>
      <HeadContent />
      <a href="#conteudo" className="sr-only z-50 rounded-sm bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      {/* no mobile cada tela tem seu topo (frames mobile); header completo a partir de md */}
      <div className="max-md:hidden">
        <Header />
      </div>
      <main id="conteudo" ref={mainRef} tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <div className={authScreen ? 'max-md:hidden' : undefined}>
        <Footer />
      </div>
      {showTabs && (
        <>
          <div aria-hidden className="h-28 md:hidden" />
          <MobileTabBar />
        </>
      )}
      <Toaster />
      <LiveRegion />
      <SessionWatcher />
      <Suspense>
        <MockPanel />
      </Suspense>
    </>
  )
}
