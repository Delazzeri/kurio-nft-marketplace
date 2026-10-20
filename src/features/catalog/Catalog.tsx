import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { useEffect } from 'react'
import { catalogTabs, categories, networks, sortOptions } from '@/api/contracts'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { announce } from '@/lib/announce'
import { cn } from '@/lib/utils'
import { Filters } from './Filters'
import { NftCard, NftCardSkeleton } from './NftCard'
import { useNftList } from './queries'
import { PAGE_SIZE, toApiQuery, type CatalogSearch } from './search'
import { Spotlight } from './Spotlight'

export function Catalog({
  search,
  filtersOpen,
  onFiltersOpenChange,
}: {
  search: CatalogSearch
  filtersOpen: boolean
  onFiltersOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate({ from: '/' })
  const query = useNftList(toApiQuery(search))
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = query

  /** Qualquer mudança de filtro reinicia a paginação. */
  const update = (patch: Partial<CatalogSearch>, resetPage = true) => {
    void navigate({
      search: (prev) => ({ ...prev, ...patch, ...(resetPage ? { page: undefined } : {}) }),
      resetScroll: false,
    })
  }

  // feedback acessível do resultado
  useEffect(() => {
    if (data && !isPlaceholderData) announce(`${data.total} ${data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}.`)
  }, [data, isPlaceholderData])

  const activeChips = [
    ...(search.q ? [{ key: 'q', label: `"${search.q}"`, remove: () => update({ q: undefined }) }] : []),
    ...(search.cat ?? []).map((c) => ({
      key: `cat-${c}`,
      label: categories.find((x) => x.id === c)?.label ?? c,
      remove: () => update({ cat: search.cat?.filter((x) => x !== c) }),
    })),
    ...(search.net ?? []).map((n) => ({
      key: `net-${n}`,
      label: networks.find((x) => x.id === n)?.label ?? n,
      remove: () => update({ net: search.net?.filter((x) => x !== n) }),
    })),
    ...(search.min || search.max
      ? [{ key: 'price', label: `${search.min ?? '0'}–${search.max ?? '∞'} ETH`, remove: () => update({ min: undefined, max: undefined }) }]
      : []),
  ]

  const filters = <Filters facets={data?.facets} search={search} onChange={update} />

  const sortControl = (id: string) => (
    <>
      <label htmlFor={id} className="text-sm whitespace-nowrap">
        Ordenar por:
      </label>
      <Select value={search.sort ?? 'recent'} onValueChange={(v) => update({ sort: v === 'recent' ? undefined : (v as CatalogSearch['sort']) })}>
        <SelectTrigger id={id} className="h-8 border-0 px-1 text-sm max-md:border max-md:px-3">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )

  return (
    <section id="catalogo" aria-labelledby="catalogo-titulo" className="container-page scroll-mt-4 pt-6 md:pt-14">
      <h2 id="catalogo-titulo" className="sr-only">
        Catálogo de NFTs
      </h2>
      <div className="grid gap-8 lg:grid-cols-[310px_1fr]">
        <aside className="hidden flex-col gap-10 lg:flex" aria-label="Filtros">
          <div className="bg-card px-6 py-6">{filters}</div>
          <Spotlight />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 md:border-b md:border-border">
            <div role="group" aria-label="Lançamentos" className="-mb-px flex gap-4 overflow-x-auto max-md:w-full max-md:justify-between md:gap-5">
              {catalogTabs.map((t) => {
                const active = (search.tab ?? 'all') === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ tab: t.id === 'all' ? undefined : t.id })}
                    className={cn(
                      'shrink-0 border-b-2 py-2 text-sm whitespace-nowrap transition-colors max-md:text-[13px]',
                      active ? 'border-primary font-semibold text-primary' : 'border-transparent hover:text-primary',
                    )}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Sheet open={filtersOpen} onOpenChange={onFiltersOpenChange}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden md:inline-flex lg:hidden">
                    <SlidersHorizontal aria-hidden /> Filtros{activeChips.length ? ` (${activeChips.length})` : ''}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-[88vw] max-w-sm overflow-y-auto border-border bg-background"
                  onCloseAutoFocus={(e) => {
                    // no mobile o drawer é aberto pelo botão da barra de busca (fora do Sheet)
                    const opener = document.getElementById('abrir-filtros-mobile')
                    if (opener && opener.offsetParent !== null) {
                      e.preventDefault()
                      opener.focus()
                    }
                  }}
                >
                  <SheetHeader>
                    <SheetTitle>Filtros</SheetTitle>
                    <SheetDescription>Os resultados são atualizados a cada seleção.</SheetDescription>
                  </SheetHeader>
                  <div className="flex flex-col gap-8 px-4 pb-8">
                    <div className="flex flex-col gap-2 md:hidden">{sortControl('ordenacao-mobile')}</div>
                    {filters}
                  </div>
                </SheetContent>
              </Sheet>
              <div className="hidden items-center gap-2 md:flex">{sortControl('ordenacao')}</div>
            </div>
          </div>

          {activeChips.length > 0 && (
            <ul aria-label="Filtros ativos" className="flex flex-wrap gap-2">
              {activeChips.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={c.remove}
                    className="inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs text-primary hover:bg-primary/10"
                    aria-label={`Remover filtro ${c.label}`}
                  >
                    {c.label} <X aria-hidden className="size-3" />
                  </button>
                </li>
              ))}
              <li>
                <Link to="/" hash="catalogo" className="inline-flex px-2 py-1 text-xs underline underline-offset-4 hover:text-primary">
                  Limpar tudo
                </Link>
              </li>
            </ul>
          )}

          <div aria-busy={isFetching} className="relative">
            {isPending ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3" data-testid="catalog-skeleton">
                {Array.from({ length: PAGE_SIZE }, (_, i) => (
                  <NftCardSkeleton key={i} />
                ))}
              </div>
            ) : isError && !data ? (
              <ErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} title="Não foi possível carregar o catálogo" />
            ) : data && data.items.length === 0 ? (
              <EmptyState
                title="Nenhum NFT encontrado"
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/" hash="catalogo">
                      Limpar filtros
                    </Link>
                  </Button>
                }
              >
                Tente remover filtros ou buscar por outro termo.
              </EmptyState>
            ) : data ? (
              <>
                {isError && (
                  <ErrorState className="mb-6 py-4" error={error} onRetry={() => void refetch()} retrying={isFetching} title="Falha ao atualizar" />
                )}
                <p className="sr-only">
                  Página {data.page} de {data.totalPages}, {data.total} resultados.
                </p>
                <ul
                  className={cn(
                    'grid grid-cols-2 gap-x-4 gap-y-8 transition-opacity sm:gap-x-6 md:grid-cols-3',
                    // grid escalonado do frame mobile
                    'max-md:[&>li:nth-child(even)]:mt-8',
                    isPlaceholderData && 'opacity-60',
                  )}
                  data-testid="catalog-grid"
                >
                  {data.items.map((nft, i) => (
                    <li key={nft.id}>
                      <NftCard nft={nft} priority={i < 3} />
                    </li>
                  ))}
                </ul>
                <Pagination page={data.page} totalPages={data.totalPages} search={search} />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function Pagination({ page, totalPages, search }: { page: number; totalPages: number; search: CatalogSearch }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const cls = 'flex size-8 items-center justify-center rounded-sm border border-border text-sm hover:border-primary'
  return (
    <nav aria-label="Paginação" className="mt-10 flex justify-end">
      <ul className="flex gap-2">
        {page > 1 && (
          <li>
            <Link to="/" search={{ ...search, page: page - 1 === 1 ? undefined : page - 1 }} hash="catalogo" className={cls} aria-label="Página anterior">
              <ChevronLeft aria-hidden className="size-4" />
            </Link>
          </li>
        )}
        {pages.map((p) => (
          <li key={p}>
            <Link
              to="/"
              search={{ ...search, page: p === 1 ? undefined : p }}
              hash="catalogo"
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p}`}
              className={cn(cls, p === page && 'border-primary bg-primary font-bold text-primary-foreground')}
            >
              {p}
            </Link>
          </li>
        ))}
        {page < totalPages && (
          <li>
            <Link to="/" search={{ ...search, page: page + 1 }} hash="catalogo" className={cls} aria-label="Próxima página">
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}
