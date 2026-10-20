import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import type { NftSummary } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { thumbnail } from '@/lib/images'
import { useIsDesktop } from '@/lib/use-media'
import { cn } from '@/lib/utils'
import { useFeatured } from './queries'

function Dots({ items, index, onSelect, className }: { items: NftSummary[]; index: number; onSelect: (i: number) => void; className?: string }) {
  if (items.length < 2) return null
  return (
    <div role="group" aria-label="Destaques" className={cn('flex gap-1', className)}>
      {items.map((n, i) => (
        <button key={n.id} type="button" aria-label={`Mostrar ${n.name}`} aria-pressed={i === index} onClick={() => onSelect(i)} className="flex size-6 items-center justify-center">
          <span aria-hidden className={cn('block size-2 rounded-full bg-primary/40 transition-all', i === index && 'w-5 bg-primary')} />
        </button>
      ))}
    </div>
  )
}

export function Hero() {
  const { data } = useFeatured()
  const [index, setIndex] = useState(0)
  const items = data?.hero ?? []
  const current = items[index]
  const secondary = items[(index + 1) % Math.max(items.length, 1)]
  const isDesktop = useIsDesktop()

  if (!isDesktop) {
    return (
      /* ------- Mobile: card (frame Mobile / Início) ------- */
      <section aria-labelledby="hero-titulo-mobile" className="px-6 pt-4">
        <div className="relative overflow-hidden rounded-[22px] bg-card p-4">
          <span aria-hidden className="absolute -top-24 left-1/3 size-72 rounded-full bg-accent/40" />
          <div className="relative grid grid-cols-[1fr_138px] gap-3">
            <div className="flex flex-col gap-2">
              <p className="text-xs">Bem-vindo à Kurio</p>
              <h1 id="hero-titulo-mobile" className="text-lg leading-snug font-bold">
                SEJA DONO DA CULTURA DIGITAL
              </h1>
              <p className="text-xs leading-relaxed text-muted-foreground">Descubra NFTs selecionados de criadores do mundo todo.</p>
              <Link to="/" hash="catalogo" className="mt-1 flex items-center gap-2 text-xs font-bold text-primary">
                EXPLORAR <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
            <div className="relative h-[138px]">
              {current ? (
                <>
                  <img src={current.image} alt={current.imageAlt} width={138} height={138} fetchPriority="high" className="size-[138px] rounded-xl object-cover" />
                  {secondary && secondary.id !== current.id && (
                    <img src={thumbnail(secondary.image)} alt="" width={56} height={56} className="absolute bottom-0 left-0 size-14 rounded-lg border-2 border-card object-cover" />
                  )}
                </>
              ) : (
                <div className="skeleton size-[138px] rounded-xl" aria-hidden />
              )}
            </div>
          </div>
          {/* altura reservada: os indicadores chegam com os dados sem deslocar o catálogo (CLS) */}
          <div className="relative mt-1 h-6">
            <Dots items={items} index={index} onSelect={setIndex} className="justify-center" />
          </div>
        </div>
      </section>
    )
  }

  return (
      /* ------- Desktop / tablet ------- */
      <section aria-labelledby="hero-titulo" className="container-page grid grid-cols-[1fr_minmax(0,450px)] items-center gap-8 pt-4">
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
            <Dots items={items} index={index} onSelect={setIndex} />
          </div>
        </div>
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
          {current ? (
            <Link to="/nft/$nftId" params={{ nftId: current.id }} aria-label={`Ver ${current.name}`}>
              <img key={current.id} src={current.image} alt={current.imageAlt} width={450} height={450} fetchPriority="high" className="size-full object-cover animate-in fade-in" />
            </Link>
          ) : (
            <div className="skeleton size-full rounded-2xl" aria-hidden />
          )}
        </div>
      </section>
  )
}
