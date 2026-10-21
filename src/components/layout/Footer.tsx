import { Link } from '@tanstack/react-router'
import { type FormEvent } from 'react'
import { categories } from '@/api/constants'
import { notAvailable } from '@/components/states'
import { SOCIAL_ICONS } from '@/components/social-icons'
import { Button } from '@/components/ui/button'

const features = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const social = [
  { label: 'Facebook', href: 'https://www.facebook.com', path: SOCIAL_ICONS.facebook },
  { label: 'Instagram', href: 'https://www.instagram.com', path: SOCIAL_ICONS.instagram },
  { label: 'Twitter', href: 'https://twitter.com', path: SOCIAL_ICONS.twitter },
  { label: 'LinkedIn', href: 'https://www.linkedin.com', path: SOCIAL_ICONS.linkedin },
  { label: 'YouTube', href: 'https://www.youtube.com', path: SOCIAL_ICONS.youtube },
]

export function WalletsPill({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex w-max max-w-full flex-wrap items-center gap-x-1.5 self-start rounded-sm border border-[#5a3a22] bg-[#2b1a10] px-2 py-1 text-[9px] font-bold tracking-wide whitespace-nowrap text-price ${className}`}>
      METAMASK <span aria-hidden>·</span> WALLETCONNECT <span aria-hidden>·</span> COINBASE
    </span>
  )
}

function OutOfScope({ label }: { label: string }) {
  return (
    <button type="button" className="text-left text-sm hover:text-primary" onClick={() => notAvailable(`"${label}"`)}>
      {label}
    </button>
  )
}

export function Footer() {
  const onNewsletter = (e: FormEvent) => {
    e.preventDefault()
    notAvailable('A inscrição na newsletter')
  }
  return (
    <footer className="below-fold container-page mt-24 pb-6">
      <div className="grid gap-8 bg-card px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-12">
        {features.map((f) => (
          <div key={f.title} className="flex flex-col gap-3 lg:border-r lg:border-primary lg:pr-6">
            <span aria-hidden className="flex size-[74px] items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {f.letter}
            </span>
            <h2 className="text-base font-bold">{f.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{f.text}</p>
          </div>
        ))}
        <form onSubmit={onNewsletter} className="flex flex-col gap-3" aria-labelledby="newsletter-title">
          <h2 id="newsletter-title" className="text-base leading-tight font-bold">
            Antecipe-se ao próximo lançamento
          </h2>
          <div className="flex">
            <label htmlFor="newsletter-email" className="sr-only">
              E-mail para receber novidades
            </label>
            <input
              id="newsletter-email"
              type="email"
              placeholder="digite seu e-mail..."
              className="h-10 min-w-0 flex-1 rounded-l-sm bg-[#2b1a12] px-3 text-sm"
            />
            <Button type="submit" className="rounded-l-none text-base">
              Enviar
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
        </form>
      </div>

      <div className="grid gap-3 bg-band px-6 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <span className="font-bold tracking-[0.2em]">KURIO</span>
        <span>Feito para colecionadores, criadores e cultura</span>
        <a href="mailto:contato@email.com" className="hover:text-primary">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="hover:text-primary">
          +55 11 4002 8922
        </a>
      </div>

      <div className="grid gap-8 bg-card px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <nav aria-labelledby="f-perfil" className="flex flex-col gap-2">
          <h2 id="f-perfil" className="mb-1 text-base font-bold">
            Meu perfil
          </h2>
          <Link to="/perfil" className="text-sm hover:text-primary">
            Meu perfil
          </Link>
          <OutOfScope label="Minha coleção" />
          <OutOfScope label="Atividade" />
          <OutOfScope label="Estúdio do criador" />
          <Link to="/perfil/favoritos" className="text-sm hover:text-primary">
            Lista de interesse
          </Link>
        </nav>
        <nav aria-labelledby="f-ajuda" className="flex flex-col gap-2">
          <h2 id="f-ajuda" className="mb-1 text-base font-bold">
            Central de ajuda
          </h2>
          {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((l) => (
            <OutOfScope key={l} label={l} />
          ))}
        </nav>
        <nav aria-labelledby="f-colecoes" className="flex flex-col gap-2">
          <h2 id="f-colecoes" className="mb-1 text-base font-bold">
            Coleções
          </h2>
          {categories
            .filter((c) => ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'utilidade'].includes(c.id))
            .map((c) => (
              <Link key={c.id} to="/" search={{ cat: [c.id] }} hash="catalogo" className="text-sm hover:text-primary">
                {c.label}
              </Link>
            ))}
        </nav>
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-bold">Redes sociais</h2>
          <ul className="flex gap-2">
            {social.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${s.label} (abre em nova aba)`}
                  className="flex size-8 items-center justify-center rounded-sm border border-primary text-primary hover:bg-primary/10"
                >
                  <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-current">
                    <path d={s.path} fillRule="evenodd" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
          <h2 className="mt-3 text-base font-bold">Carteiras compatíveis</h2>
          <WalletsPill />
        </div>
      </div>
      <p className="pt-5 text-center text-xs">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
