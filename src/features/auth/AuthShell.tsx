import { Link, useNavigate } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { notAvailable } from '@/components/states'
import { cn } from '@/lib/utils'

/** Só aceita destinos internos (evita open redirect). */
export function safeRedirect(target: string | undefined) {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/'
  if (target.startsWith('/entrar') || target.startsWith('/cadastro')) return '/'
  return target
}

const GoogleIcon = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-4">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12Z" />
  </svg>
)
const FacebookIcon = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-[#3b5998]">
    <path d="M14 8h3V4h-3c-2.8 0-4 1.7-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6Z" />
  </svg>
)

export function SocialLogin() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs">
        <span className="h-px flex-1 bg-border" />
        Ou continue com
        <span className="h-px flex-1 bg-border" />
      </div>
      <button type="button" onClick={() => notAvailable('O login com Google')} className="flex h-10 items-center justify-center gap-3 rounded-sm border border-border text-xs hover:border-primary">
        <GoogleIcon /> Continuar com Google
      </button>
      <button type="button" onClick={() => notAvailable('O login com Facebook')} className="flex h-10 items-center justify-center gap-3 rounded-sm border border-border text-xs hover:border-primary">
        <FacebookIcon /> Continuar com Facebook
      </button>
    </div>
  )
}

/**
 * Desktop: cartão em formato de modal (frames Desktop / Login e Cadastro).
 * Mobile: tela cheia com a marca no topo (frames Mobile / Login e Cadastro).
 */
export function AuthShell({
  mode,
  redirect,
  description,
  mobileTitle,
  children,
  footer,
}: {
  mode: 'login' | 'register'
  redirect?: string
  description: string
  mobileTitle: string
  children: ReactNode
  footer: ReactNode
}) {
  const navigate = useNavigate()
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [mode])

  const close = () => void navigate({ to: safeRedirect(redirect) })

  return (
    <div className="relative flex min-h-[calc(100dvh)] justify-center px-7 md:min-h-[720px] md:items-start md:bg-[radial-gradient(circle_at_70%_10%,#3a2419_0,transparent_55%)] md:px-4 md:pt-16">
      <section
        aria-labelledby="auth-titulo"
        className="relative flex w-full max-w-[404px] flex-col gap-6 pt-28 pb-10 md:border-b-8 md:border-primary md:bg-card md:px-16 md:pt-12 md:pb-14 md:shadow-2xl"
      >
        <p aria-hidden className="text-center text-3xl font-bold tracking-[0.1em] md:hidden">
          KURIO
        </p>
        <button type="button" onClick={close} aria-label="Fechar e voltar" className="absolute top-4 right-4 hidden text-primary hover:text-price md:block">
          <X className="size-5" aria-hidden />
        </button>

        <h1 id="auth-titulo" ref={headingRef} tabIndex={-1} className="mt-10 text-center text-lg font-bold outline-none md:sr-only md:mt-0">
          {mobileTitle}
        </h1>
        <nav aria-label="Entrar ou criar conta" className="hidden items-center justify-center gap-2 text-lg md:flex">
          <Link
            to="/entrar"
            search={{ redirect }}
            aria-current={mode === 'login' ? 'page' : undefined}
            className={cn(mode === 'login' ? 'text-primary' : 'hover:text-primary')}
          >
            Entrar
          </Link>
          <span aria-hidden className="h-5 w-px bg-primary" />
          <Link
            to="/cadastro"
            search={{ redirect }}
            aria-current={mode === 'register' ? 'page' : undefined}
            className={cn(mode === 'register' ? 'text-primary' : 'hover:text-primary')}
          >
            Criar conta
          </Link>
        </nav>
        <p className="hidden text-center text-xs leading-relaxed md:block">{description}</p>
        {children}
        <SocialLogin />
        <div className="text-center text-sm text-muted-foreground md:hidden">{footer}</div>
      </section>
    </div>
  )
}
