import { useNavigate } from '@tanstack/react-router'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useIsDesktop } from '@/lib/use-media'
import type { CatalogSearch } from './search'

/** Topo da Início no mobile: busca + atalho de filtros (frame Mobile / Início). */
export function MobileSearchBar({ search, onOpenFilters, activeFilters }: { search: CatalogSearch; onOpenFilters: () => void; activeFilters: number }) {
  const navigate = useNavigate({ from: '/' })
  const [value, setValue] = useState(search.q ?? '')
  const isDesktop = useIsDesktop()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void navigate({ search: (prev) => ({ ...prev, q: value.trim() || undefined, page: undefined }), hash: 'catalogo' })
  }
  if (isDesktop) return null
  return (
    <div className="flex gap-2 px-6 pt-10">
      <form role="search" onSubmit={submit} className="relative flex-1">
        <label htmlFor="busca-mobile" className="sr-only">
          Explorar coleções
        </label>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          id="busca-mobile"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Explorar coleções"
          className="h-11 w-full rounded-lg bg-card pr-3 pl-10 text-sm placeholder:text-muted-foreground"
        />
      </form>
      <button
        id="abrir-filtros-mobile"
        type="button"
        onClick={onOpenFilters}
        aria-label={`Filtros e ordenação${activeFilters ? `, ${activeFilters} ativos` : ''}`}
        className="relative flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-price to-primary text-primary-foreground"
      >
        <SlidersHorizontal aria-hidden className="size-5" />
        {activeFilters > 0 && (
          <span aria-hidden className="absolute -top-1 -right-1 rounded-full bg-foreground px-1 text-[10px] leading-4 font-bold text-background">
            {activeFilters}
          </span>
        )}
      </button>
    </div>
  )
}
