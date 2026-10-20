import { useState } from 'react'
import type { NftListResponse } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import type { CatalogSearch } from './search'

type Facets = NftListResponse['facets']

const fmt = (v: string | number) => Number(v).toFixed(2).replace('.', ',')

function FacetList({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string
  items: Facets['categories']
  selected: string[]
  onToggle: (id: string) => void
}) {
  const id = `facet-${title}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <h3 id={id} className="mb-2 text-base font-bold">
        {title}
      </h3>
      <ul className="flex flex-col">
        {items.map((f) => {
          const active = selected.includes(f.id)
          return (
            <li key={f.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(f.id)}
                className={cn(
                  'flex h-8 w-full items-center justify-between rounded-sm px-2.5 text-sm transition-colors hover:bg-accent',
                  active ? 'bg-accent font-semibold text-price' : 'text-muted-foreground',
                )}
              >
                <span className="flex items-center gap-2">
                  {/* indicador não depende só de cor */}
                  <span aria-hidden className={cn('size-2 rounded-full border border-primary', active && 'bg-primary')} />
                  {f.label}
                </span>
                <span className="tabular-nums">({f.count})</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Estado local do slider até "Aplicar"; remonta (key) quando URL/facetas mudam. */
function PriceRange({ min, max, search, onChange }: { min: number; max: number; search: CatalogSearch; onChange: (patch: Partial<CatalogSearch>) => void }) {
  const initial: [number, number] = [Number(search.min ?? min), Number(search.max ?? max)]
  const [range, setRange] = useState<[number, number]>(initial)
  const changed = range[0] !== initial[0] || range[1] !== initial[1]
  return (
    <section aria-labelledby="facet-preco" className="flex flex-col gap-3">
      <h3 id="facet-preco" className="text-base font-bold">
        Faixa de preço
      </h3>
      <Slider
        min={min}
        max={max}
        step={0.01}
        value={range}
        onValueChange={(v) => setRange([v[0] ?? min, v[1] ?? max])}
        minStepsBetweenThumbs={1}
        aria-label="Faixa de preço"
        thumbLabels={['Preço mínimo', 'Preço máximo']}
      />
      <p className="text-sm">
        Preço: {fmt(range[0])} - {fmt(range[1])} ETH
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="w-fit"
          disabled={!changed}
          onClick={() =>
            onChange({
              min: range[0] > min ? range[0].toFixed(2) : undefined,
              max: range[1] < max ? range[1].toFixed(2) : undefined,
            })
          }
        >
          Aplicar
        </Button>
        {(search.min || search.max) && (
          <Button size="sm" variant="ghost" onClick={() => onChange({ min: undefined, max: undefined })}>
            Limpar
          </Button>
        )}
      </div>
    </section>
  )
}

export function Filters({
  facets,
  search,
  onChange,
}: {
  facets: Facets | undefined
  search: CatalogSearch
  onChange: (patch: Partial<CatalogSearch>) => void
}) {
  const toggle = (key: 'cat' | 'net', id: string) => {
    const current = (search[key] ?? []) as string[]
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    onChange({ [key]: next.length ? next : undefined } as Partial<CatalogSearch>)
  }

  if (!facets) {
    return (
      <div className="flex flex-col gap-3" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="skeleton h-6" />
        ))}
      </div>
    )
  }

  const min = Number(facets.priceRange.min)
  const max = Number(facets.priceRange.max)

  return (
    <div className="flex flex-col gap-8">
      <FacetList title="Coleções" items={facets.categories} selected={search.cat ?? []} onToggle={(id) => toggle('cat', id)} />
      <PriceRange key={[min, max, search.min, search.max].join('|')} min={min} max={max} search={search} onChange={onChange} />
      <FacetList title="Rede" items={facets.networks} selected={search.net ?? []} onToggle={(id) => toggle('net', id)} />
    </div>
  )
}
