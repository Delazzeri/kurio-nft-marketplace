import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Download, Heart, LineChart, LogOut, MapPin, ShoppingCart, User } from 'lucide-react'
import type { ComponentType } from 'react'
import { authService } from '@/auth/auth-service'
import { MobileTopBar } from '@/components/layout/MobileNav'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_auth/perfil')({
  component: ProfileLayout,
})

const item = 'flex h-11 w-full shrink-0 items-center gap-3 border-l-[6px] border-transparent px-4 text-sm whitespace-nowrap text-primary transition-colors hover:bg-accent'
const activeItem = 'border-primary bg-accent/40 font-semibold'

function Disabled({ icon: Icon, label }: { icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; label: string }) {
  return (
    <li>
      <span aria-disabled="true" className={cn(item, 'cursor-not-allowed text-primary/60 hover:bg-transparent')}>
        <Icon aria-hidden className="size-4" />
        {label}
        <span className="ml-auto rounded-sm border border-border px-1.5 text-[10px] text-muted-foreground">Em breve</span>
      </span>
    </li>
  )
}

function ProfileLayout() {
  const navigate = useNavigate()
  return (
    <>
    <MobileTopBar title="Meu perfil" />
    <div className="container-page grid gap-7 md:pt-8 lg:grid-cols-[310px_1fr]">
      <nav aria-labelledby="perfil-menu" className="h-fit min-w-0 bg-card max-lg:rounded-xl lg:pt-6">
        <h2 id="perfil-menu" className="px-3 pb-2 text-lg font-bold max-lg:sr-only">
          Meu perfil
        </h2>
        <ul className="flex overflow-x-auto lg:flex-col">
          <li>
            <Link to="/perfil" activeOptions={{ exact: true }} className={item} activeProps={{ className: activeItem, 'aria-current': 'page' }}>
              <User aria-hidden className="size-4" /> Dados do perfil
            </Link>
          </li>
          <li>
            <Link to="/perfil/carteiras" className={item} activeProps={{ className: activeItem, 'aria-current': 'page' }}>
              <MapPin aria-hidden className="size-4" /> Carteiras
            </Link>
          </li>
          <Disabled icon={ShoppingCart} label="Atividade" />
          <li>
            <Link to="/perfil/favoritos" className={item} activeProps={{ className: activeItem, 'aria-current': 'page' }}>
              <Heart aria-hidden className="size-4" /> Lista de interesse
            </Link>
          </li>
          <Disabled icon={LineChart} label="Ofertas" />
          <Disabled icon={Download} label="Arquivos baixados" />
          <Disabled icon={AlertTriangle} label="Suporte" />
          <li className="lg:border-t lg:border-border">
            <button
              type="button"
              className={cn(item, 'font-semibold')}
              onClick={async () => {
                await authService.logout()
                void navigate({ to: '/' })
              }}
            >
              <LogOut aria-hidden className="size-4" /> Sair
            </button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
    </>
  )
}
