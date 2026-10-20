import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFeatured } from './queries'

export function Hero() {
  const { data } = useFeatured()
  const [index, setIndex] = useState(0)
  const current = data?.hero[index]

  return (
    <section aria-labelledby="hero-titulo" className="container-page grid items-center gap-8 pt-8 md:grid-cols-[1fr_minmax(0,450px)] md:pt-4">
      <div className="flex flex-col gap-5 md:pl-10">
        <p className="text-sm">Bem-vindo à Kurio</p>
        <h1 id="hero-titulo" className="text-3xl leading-[1.35] font-bold tracking-wide sm:text-4xl lg:text-[44px]">
          SEJA DONO DO FUTURO
          <br />
          DA ARTE DIGITAL
        </h1>
        <p className="max-w-[460px] text-sm leading-relaxed text-muted-foreground">
          Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da
          cultura da internet.
        </p>
        <div className="flex items-center justify-between gap-6 md:pr-16">
          <Button asChild className="w-fit">
            <Link to="/" hash="catalogo">
              EXPLORAR
            </Link>
          </Button>
          {data && data.hero.length > 1 && (
            <div role="group" aria-label="Destaques" className="flex gap-2">
              {data.hero.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  aria-label={`Mostrar ${n.name}`}
                  aria-pressed={i === index}
                  onClick={() => setIndex(i)}
                  className="flex size-6 items-center justify-center"
                >
                  <span aria-hidden className={cn('block size-2 rounded-full bg-primary/40 transition-all', i === index && 'w-5 bg-primary')} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
        {current ? (
          <Link to="/nft/$nftId" params={{ nftId: current.id }} aria-label={`Ver ${current.name}`}>
            <img
              key={current.id}
              src={current.image}
              alt={current.imageAlt}
              width={450}
              height={450}
              fetchPriority="high"
              className="size-full object-cover animate-in fade-in"
            />
          </Link>
        ) : (
          <div className="skeleton size-full rounded-2xl" aria-hidden />
        )}
      </div>
    </section>
  )
}
