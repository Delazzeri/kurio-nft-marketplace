import { Link, useLocation, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Heart, Home, ScanSearch, ShoppingCart, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSession } from '@/auth/session-store'
import { useCart } from '@/features/cart/queries'
import { cn } from '@/lib/utils'

/** Barra de topo mobile (frames Mobile / Carrinho e Pagamento): voltar + título. */
export function MobileTopBar({ title, action }: { title: string; action?: ReactNode }) {
  const router = useRouter()
  const navigate = useNavigate()
  return (
    <div className="flex items-center gap-4 px-7 pt-6 pb-4 md:hidden">
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => (window.history.length > 1 ? router.history.back() : void navigate({ to: '/' }))}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/60 text-primary"
      >
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
      {action}
    </div>
  )
}

/** Navegação inferior mobile (frame Mobile / Início). */
export function MobileTabBar() {
  const { pathname } = useLocation()
  const { user } = useSession()
  const { data: cart } = useCart()
  const count = cart?.itemCount ?? 0
  const tab = 'flex size-12 items-center justify-center rounded-full transition-colors'
  const on = (active: boolean) => cn(tab, active ? 'text-primary' : 'text-foreground/80 hover:text-primary')
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-30 md:hidden">
      <div className="relative mx-auto flex h-[74px] max-w-[480px] items-center justify-between rounded-t-[28px] bg-card px-8 shadow-[0_-6px_20px_rgba(0,0,0,0.35)]">
        <Link to="/" aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined} className={on(pathname === '/')}>
          <Home aria-hidden className="size-6" fill={pathname === '/' ? 'currentColor' : 'none'} />
        </Link>
        <Link
          to="/perfil/favoritos"
          aria-label="Lista de interesse"
          aria-current={pathname === '/perfil/favoritos' ? 'page' : undefined}
          className={on(pathname === '/perfil/favoritos')}
        >
          <Heart aria-hidden className="size-6" fill="currentColor" />
        </Link>
        <Link
          to="/"
          hash="catalogo"
          aria-label="Explorar catálogo"
          className="absolute -top-7 left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full border-[6px] border-background bg-gradient-to-br from-price to-primary text-primary-foreground shadow-lg"
        >
          <ScanSearch aria-hidden className="size-6" />
        </Link>
        <span aria-hidden className="w-12" />
        <Link to="/carrinho" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`} className={cn(on(pathname === '/carrinho'), 'relative')}>
          <ShoppingCart aria-hidden className="size-6" />
          {count > 0 && (
            <span aria-hidden className="absolute top-1.5 right-1 rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </Link>
        <Link
          to={user ? '/perfil' : '/entrar'}
          aria-label={user ? 'Meu perfil' : 'Entrar'}
          aria-current={pathname.startsWith('/perfil') && pathname !== '/perfil/favoritos' ? 'page' : undefined}
          className={on(pathname.startsWith('/perfil') && pathname !== '/perfil/favoritos')}
        >
          <User aria-hidden className="size-6" fill="currentColor" />
        </Link>
      </div>
    </nav>
  )
}
