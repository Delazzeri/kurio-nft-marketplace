import { Link, useLocation, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, ScanLine } from 'lucide-react'
import { lazy, Suspense, type ReactNode } from 'react'
import { useSession } from '@/auth/session-store'
import { useIsDesktop } from '@/lib/use-media'
import { cn } from '@/lib/utils'

/** Barra de topo mobile (frames Mobile / Carrinho e Pagamento): voltar + título. */
export function MobileTopBar({ title, action }: { title: string; action?: ReactNode }) {
  const router = useRouter()
  const navigate = useNavigate()
  if (useIsDesktop()) return null
  return (
    <div className="flex items-center gap-4 px-7 pt-6 pb-4">
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

const CartCountBadge = lazy(() => import('./CartCountBadge'))

/* Ícones sólidos do frame Mobile / Início (o Figma usa versões preenchidas) */
const icons = {
  home: 'M12 2.8 2.6 10.2V20a1.6 1.6 0 0 0 1.6 1.6H9.3v-6.1h5.4v6.1h5.1a1.6 1.6 0 0 0 1.6-1.6v-9.8Z',
  heart: 'M12 21s-7.9-4.9-9.6-10A5.3 5.3 0 0 1 12 6.1 5.3 5.3 0 0 1 21.6 11c-1.7 5.1-9.6 10-9.6 10Z',
  user: 'M12 11.4a4.3 4.3 0 1 0 0-8.6 4.3 4.3 0 0 0 0 8.6Zm-7.6 9.8c0-3.4 2.6-6.2 5.9-6.2h3.4c3.3 0 5.9 2.8 5.9 6.2v.6H4.4Z',
}

function SolidIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-6 fill-current">
      <path d={path} />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-6">
      <path d="M2.5 3.6h2.4l2.5 11.1" className="fill-none stroke-current" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.6 6.4h15.1l-1.9 7.9a1.5 1.5 0 0 1-1.5 1.1H9a1.5 1.5 0 0 1-1.5-1.2Z" className="fill-current" />
      <path d="M9.4 9.4h8.4M10 12.2h7.1" className="fill-none stroke-card" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9.6" cy="19.6" r="1.6" className="fill-current" />
      <circle cx="17.2" cy="19.6" r="1.6" className="fill-current" />
    </svg>
  )
}

/**
 * Recorte côncavo em torno do botão central (frame Mobile / Início).
 * Geometria: arco do recorte r=46 centrado em (70, 0); concordâncias r=14 tangentes à borda
 * superior e ao arco — centros em (11.66, 14) e (128.34, 14).
 */
const NOTCH_WIDTH = 140
const BAR_HEIGHT = 92

function NotchPiece() {
  return (
    <svg aria-hidden width={NOTCH_WIDTH} height={BAR_HEIGHT} viewBox={`0 0 ${NOTCH_WIDTH} ${BAR_HEIGHT}`} className="block shrink-0 fill-card">
      <path d={`M0 0H11.66A14 14 0 0 1 25.27 10.73A46 46 0 0 0 114.73 10.73A14 14 0 0 1 128.34 0H${NOTCH_WIDTH}V${BAR_HEIGHT}H0Z`} />
    </svg>
  )
}

/** Navegação inferior mobile — idêntica ao frame Mobile / Início. */
export function MobileTabBar() {
  const { pathname } = useLocation()
  const { user } = useSession()
  const onFavorites = pathname === '/perfil/favoritos'
  const onProfile = pathname.startsWith('/perfil') && !onFavorites
  const item = (active: boolean) =>
    cn(
      'absolute top-[50px] flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors',
      active ? 'text-price' : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-30 md:hidden">
      <div className="relative mx-auto max-w-[480px] drop-shadow-[0_-6px_14px_rgba(0,0,0,0.35)]">
        <div className="flex" style={{ height: BAR_HEIGHT }}>
          <div className="flex-1 rounded-tl-[32px] bg-card" />
          <NotchPiece />
          <div className="flex-1 rounded-tr-[32px] bg-card" />
        </div>
        {/* área segura (iPhone) */}
        <div className="bg-card pb-[env(safe-area-inset-bottom)]" />

        <Link to="/" aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined} className={cn(item(pathname === '/'), 'left-[11.1%]')}>
          <SolidIcon path={icons.home} />
        </Link>
        <Link to="/perfil/favoritos" aria-label="Lista de interesse" aria-current={onFavorites ? 'page' : undefined} className={cn(item(onFavorites), 'left-[28.5%]')}>
          <SolidIcon path={icons.heart} />
        </Link>
        <Link
          to="/"
          hash="catalogo"
          aria-label="Explorar catálogo"
          className="absolute -top-[30px] left-1/2 flex size-[64px] -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-[#a9693c]/95 to-[#e6ad7c]/90 text-foreground shadow-[0_6px_16px_rgba(0,0,0,0.35)] transition-transform active:scale-95"
        >
          <ScanLine aria-hidden className="size-7" strokeWidth={1.75} />
        </Link>
        <Link
          to="/carrinho"
          aria-current={pathname === '/carrinho' ? 'page' : undefined}
          className={cn(item(pathname === '/carrinho'), 'left-[72.9%]')}
        >
          <CartIcon />
          <span className="sr-only">Carrinho</span>
          <Suspense>
            <CartCountBadge />
          </Suspense>
        </Link>
        <Link
          to={user ? '/perfil' : '/entrar'}
          aria-label={user ? 'Meu perfil' : 'Entrar'}
          aria-current={onProfile ? 'page' : undefined}
          className={cn(item(onProfile), 'left-[87.9%]')}
        >
          <SolidIcon path={icons.user} />
        </Link>
      </div>
    </nav>
  )
}
