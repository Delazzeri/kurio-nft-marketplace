import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Heart, LogIn, LogOut, Menu, Search, ShoppingCart, User, Wallet, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { authService } from '@/auth/auth-service'
import { useSession } from '@/auth/session-store'
import { notAvailable } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCart } from '@/features/cart/queries'
import { cn } from '@/lib/utils'

type NavKey = 'inicio' | 'mercado'

function useActiveNav(): NavKey | null {
  const { pathname } = useLocation()
  if (pathname === '/') return 'inicio'
  if (pathname.startsWith('/nft') || pathname.startsWith('/carrinho') || pathname.startsWith('/pagamento') || pathname.startsWith('/pedidos'))
    return 'mercado'
  return null
}

function NavItems({ onNavigate, vertical = false }: { onNavigate?: () => void; vertical?: boolean }) {
  const active = useActiveNav()
  const base = cn(
    'relative inline-flex items-center text-sm transition-colors hover:text-primary',
    vertical ? 'h-12 w-full border-b border-border px-1 text-base' : 'h-full px-1',
  )
  const activeCls = vertical ? 'text-primary font-semibold' : 'text-primary font-semibold after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary'
  return (
    <>
      <Link to="/" className={cn(base, active === 'inicio' && activeCls)} aria-current={active === 'inicio' ? 'page' : undefined} onClick={onNavigate}>
        Início
      </Link>
      <Link
        to="/"
        hash="catalogo"
        className={cn(base, active === 'mercado' && activeCls)}
        aria-current={active === 'mercado' ? 'page' : undefined}
        onClick={onNavigate}
      >
        Mercado
      </Link>
      {(['Criadores', 'Aprenda'] as const).map((label) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <button type="button" aria-disabled="true" className={cn(base, 'cursor-not-allowed text-foreground/80 hover:text-foreground/80')} onClick={() => notAvailable(`A página ${label}`)}>
              {label}
            </button>
          </TooltipTrigger>
          <TooltipContent>Em breve</TooltipContent>
        </Tooltip>
      ))}
    </>
  )
}

function SearchBox({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    void navigate({ to: '/', search: (prev) => ({ ...prev, q: q || undefined, page: undefined }), hash: 'catalogo' })
    onDone()
  }
  return (
    <form role="search" onSubmit={submit} className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Buscar NFTs
      </label>
      <input
        ref={inputRef}
        id={id}
        name="q"
        type="search"
        placeholder="Buscar NFTs, coleções…"
        className="h-9 w-48 rounded-sm border border-border bg-background px-3 text-sm focus:border-primary md:w-64"
        onKeyDown={(e) => e.key === 'Escape' && onDone()}
      />
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Fechar busca" onClick={onDone}>
        <X />
      </Button>
    </form>
  )
}

function CartLink() {
  const { data } = useCart()
  const count = data?.itemCount ?? 0
  return (
    <Link to="/carrinho" className="relative inline-flex size-10 items-center justify-center rounded-sm hover:bg-accent" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
      <ShoppingCart aria-hidden className="size-6" />
      {count > 0 && (
        <span aria-hidden className="absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

function UserMenu() {
  const { user } = useSession()
  const navigate = useNavigate()
  if (!user) return null
  const initials = user.displayName.slice(0, 1).toUpperCase()
  return (
    <div className="flex items-center gap-2">
      <Link to="/perfil" className="flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent" aria-label={`Meu perfil (${user.displayName})`}>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
            {initials}
          </span>
        )}
        <span className="hidden max-w-32 truncate text-sm lg:inline">{user.displayName}</span>
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Sair"
        onClick={async () => {
          await authService.logout()
          void navigate({ to: '/' })
        }}
      >
        <LogOut />
      </Button>
    </div>
  )
}

export function Header() {
  const { user } = useSession()
  const location = useLocation()
  const [searching, setSearching] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const redirect = location.href

  return (
    <header className="container-page">
      <div className="flex h-[68px] items-center justify-between gap-4 border-b border-[#3f2319]">
        <div className="flex items-center gap-2">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-sm border-border bg-background">
              <SheetHeader>
                <SheetTitle className="text-left tracking-[0.2em]">KURIO</SheetTitle>
                <SheetDescription className="sr-only">Navegação principal</SheetDescription>
              </SheetHeader>
              <nav aria-label="Principal (menu)" className="flex flex-col px-4">
                <NavItems vertical onNavigate={() => setMenuOpen(false)} />
                {user ? (
                  <>
                    <Link to="/perfil" className="flex h-12 items-center gap-2 border-b border-border" onClick={() => setMenuOpen(false)}>
                      <User className="size-4" aria-hidden /> Meu perfil
                    </Link>
                    <Link to="/perfil/carteiras" className="flex h-12 items-center gap-2 border-b border-border" onClick={() => setMenuOpen(false)}>
                      <Wallet className="size-4" aria-hidden /> Carteiras
                    </Link>
                    <Link to="/perfil/favoritos" className="flex h-12 items-center gap-2 border-b border-border" onClick={() => setMenuOpen(false)}>
                      <Heart className="size-4" aria-hidden /> Lista de interesse
                    </Link>
                  </>
                ) : null}
              </nav>
            </SheetContent>
          </Sheet>
          <Link to="/" className="text-sm font-bold tracking-[0.2em]" aria-label="Kurio — página inicial">
            KURIO
          </Link>
        </div>

        <nav aria-label="Principal" className="hidden h-full items-stretch gap-10 md:flex">
          <NavItems />
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          {searching ? (
            <SearchBox onDone={() => setSearching(false)} />
          ) : (
            <Button variant="ghost" size="icon" aria-label="Buscar NFTs" onClick={() => setSearching(true)}>
              <Search className="size-6" />
            </Button>
          )}
          <CartLink />
          {user ? (
            <UserMenu />
          ) : (
            <Button asChild size="sm" className="h-9 text-base">
              <Link to="/entrar" search={{ redirect }}>
                <LogIn aria-hidden />
                Entrar
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
