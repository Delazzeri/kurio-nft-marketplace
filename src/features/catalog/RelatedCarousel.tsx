import { useRef, useState } from 'react'
import type { NftSummary } from '@/api/contracts'
import { cn } from '@/lib/utils'
import { NftCard, NftCardSkeleton } from './NftCard'

/** Carrossel com scroll-snap (teclado/touch nativos) e indicadores por página. */
export function RelatedCarousel({ title, items, loading }: { title: string; items: NftSummary[] | undefined; loading?: boolean }) {
  const ref = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil((items?.length ?? 0) / 5))

  const goTo = (p: number) => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ left: (el.scrollWidth / pages) * p, behavior: 'smooth' })
  }
  const onScroll = () => {
    const el = ref.current
    if (!el) return
    setPage(Math.round(el.scrollLeft / (el.scrollWidth / pages)))
  }
  const id = `carrossel-${title.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <section aria-labelledby={id} className="below-fold container-page mt-20">
      <h2 id={id} className="border-b border-border pb-2 text-base font-bold text-primary">
        {title}
      </h2>
      <ul ref={ref} onScroll={onScroll} className="mt-7 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2 [scrollbar-width:none]">
        {loading || !items
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-[44%] shrink-0 sm:w-[30%] lg:w-[calc((100%-96px)/5)]">
                <NftCardSkeleton />
              </li>
            ))
          : items.map((nft) => (
              <li key={nft.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[calc((100%-96px)/5)]">
                <NftCard nft={nft} actions={false} />
              </li>
            ))}
      </ul>
      {pages > 1 && (
        <div role="group" aria-label={`Páginas de ${title}`} className="mt-5 flex justify-center gap-1">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} type="button" aria-label={`Ir para a página ${i + 1}`} aria-pressed={i === page} onClick={() => goTo(i)} className="flex size-6 items-center justify-center">
              <span aria-hidden className={cn('size-2.5 rounded-full border border-primary', i === page && 'bg-primary')} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
