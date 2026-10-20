import { useQueries } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { NftCard, NftCardSkeleton } from '@/features/catalog/NftCard'
import { nftDetailQuery } from '@/features/catalog/queries'
import { useFavorites } from '@/features/favorites/queries'

export const Route = createFileRoute('/_auth/perfil/favoritos')({
  head: () => ({ meta: [{ title: 'Lista de interesse — Kurio' }] }),
  component: FavoritesPage,
})

function FavoritesPage() {
  const favorites = useFavorites()
  const ids = favorites.data?.nftIds ?? []
  const details = useQueries({ queries: ids.map((id) => nftDetailQuery(id)) })

  return (
    <section aria-labelledby="favoritos-titulo" className="flex flex-col gap-6">
      <h1 id="favoritos-titulo" className="text-base font-bold">
        Lista de interesse
      </h1>
      {favorites.isPending ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </div>
      ) : favorites.isError ? (
        <ErrorState error={favorites.error} onRetry={() => void favorites.refetch()} />
      ) : ids.length === 0 ? (
        <EmptyState
          title="Nenhum favorito ainda"
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/" hash="catalogo">
                Explorar NFTs
              </Link>
            </Button>
          }
        >
          Toque no coração de um NFT para salvá-lo aqui.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-6 md:grid-cols-3">
          {details.map((q, i) => (
            <li key={ids[i]}>{q.data ? <NftCard nft={q.data} /> : <NftCardSkeleton />}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
