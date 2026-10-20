import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { MobileSearchBar } from '@/features/catalog/MobileSearchBar'
import { Catalog } from '@/features/catalog/Catalog'
import { Hero } from '@/features/catalog/Hero'
import { Journal, PromoBanners } from '@/features/catalog/HomeExtras'
import { parseCatalogSearch, toApiQuery } from '@/features/catalog/search'

export const Route = createFileRoute('/')({
  validateSearch: parseCatalogSearch,
  loaderDeps: ({ search }) => search,
  // prefetch sem bloquear a navegação: skeletons aparecem enquanto a API responde
  // (camada de dados importada sob demanda: não bloqueia a primeira pintura)
  loader: ({ context, deps }) => {
    void import('@/features/catalog/queries').then(({ featuredQuery, nftListQuery }) => {
      void context.queryClient.prefetchQuery(nftListQuery(toApiQuery(deps)))
      void context.queryClient.prefetchQuery(featuredQuery)
    })
  },
  head: () => ({ meta: [{ title: 'Kurio — Marketplace de NFTs' }] }),
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilters = (search.cat?.length ?? 0) + (search.net?.length ?? 0) + (search.min || search.max ? 1 : 0)
  return (
    <>
      <MobileSearchBar search={search} onOpenFilters={() => setFiltersOpen(true)} activeFilters={activeFilters} />
      <Hero />
      <Catalog search={search} filtersOpen={filtersOpen} onFiltersOpenChange={setFiltersOpen} />
      <PromoBanners />
      <Journal />
    </>
  )
}
