import { Link } from '@tanstack/react-router'
import { AlertTriangle, RefreshCw, SearchX, WifiOff } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { isApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { onAnnounce } from '@/lib/announce'
import { cn } from '@/lib/utils'

export function ErrorState({
  error,
  onRetry,
  retrying,
  title = 'Não foi possível carregar',
  className,
}: {
  error: unknown
  onRetry?: () => void
  retrying?: boolean
  title?: string
  className?: string
}) {
  const offline = isApiError(error) && (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT')
  const message = isApiError(error) ? error.message : 'Erro inesperado.'
  const Icon = offline ? WifiOff : AlertTriangle
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-md border border-border bg-card px-6 py-10 text-center', className)}>
      <Icon aria-hidden className="size-8 text-price" />
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} disabled={retrying} variant="outline" size="sm">
          <RefreshCw aria-hidden className={cn(retrying && 'animate-spin')} />
          {retrying ? 'Tentando novamente…' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-12 text-center">
      <SearchX aria-hidden className="size-8 text-muted-foreground" />
      <h2 className="text-base font-semibold">{title}</h2>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
      {action}
    </div>
  )
}

export function NotFound({ title = 'Página não encontrada', description }: { title?: string; description?: string }) {
  return (
    <section className="container-page flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="max-w-md text-muted-foreground">{description ?? 'O endereço acessado não existe ou foi removido.'}</p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </section>
  )
}

/** Região aria-live global para mutations e eventos em tempo real. */
export function LiveRegion() {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  useEffect(
    () =>
      onAnnounce((message, politeness) => {
        const setter = politeness === 'assertive' ? setAssertive : setPolite
        setter('')
        // força nova leitura mesmo com mensagem repetida
        requestAnimationFrame(() => setter(message))
      }),
    [],
  )
  return (
    <>
      <div aria-live="polite" role="status" className="sr-only" data-testid="live-polite">
        {polite}
      </div>
      <div aria-live="assertive" role="alert" className="sr-only" data-testid="live-assertive">
        {assertive}
      </div>
    </>
  )
}

/** Ação fora do escopo da entrega: não simula sucesso, informa claramente. */
export function notAvailable(feature: string) {
  toast.info(`${feature} não faz parte desta demonstração.`)
}
