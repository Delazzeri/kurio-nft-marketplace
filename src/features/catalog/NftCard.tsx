import { Link } from '@tanstack/react-router'
import { Search, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { Price } from '@/components/Price'
import { useAddToCart } from '@/features/cart/queries'
import { FavoriteIconButton } from '@/features/favorites/FavoriteButton'
import { thumbnail } from '@/lib/images'
import { cn } from '@/lib/utils'

export function NftCard({ nft, priority = false, actions = true }: { nft: NftSummary; priority?: boolean; actions?: boolean }) {
  const addToCart = useAddToCart()
  const soldOut = nft.available === 0
  return (
    <article className="group relative flex flex-col gap-3" aria-labelledby={`nft-${nft.id}-name`}>
      <div className="relative aspect-[310/368] overflow-hidden rounded-[20px] bg-card p-1.5 md:rounded-none">
        <img
          src={thumbnail(nft.image)}
          srcSet={`${thumbnail(nft.image)} 400w, ${nft.image} 500w`}
          sizes="(min-width: 1024px) 300px, (min-width: 768px) 30vw, 45vw"
          alt={nft.imageAlt}
          width={300}
          height={356}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="size-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        {nft.badge && (
          <span className="absolute top-1.5 left-1.5 bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{nft.badge}</span>
        )}
        {actions && <FavoriteIconButton nftId={nft.id} name={nft.name} className="absolute top-3 right-3 z-10 size-8 rounded-lg bg-background/70 md:hidden" />}
        {soldOut && (
          <span className="absolute top-1.5 right-1.5 bg-background/90 max-md:top-auto max-md:bottom-3 px-2 py-1 text-xs font-semibold text-foreground">ESGOTADO</span>
        )}
        {actions && (
          <div
            className={cn(
              'absolute inset-x-0 bottom-3 flex justify-center gap-2 transition-opacity max-md:hidden',
              'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
            )}
          >
            <button
              type="button"
              disabled={soldOut || addToCart.isPending}
              aria-label={soldOut ? `${nft.name} esgotado` : `Adicionar ${nft.name} ao carrinho`}
              onClick={() => addToCart.mutate({ nftId: nft.id, editionId: '1-50', quantity: 1, name: nft.name })}
              className="relative z-10 flex size-9 items-center justify-center rounded-sm bg-card/90 hover:text-primary disabled:opacity-50"
            >
              <ShoppingCart aria-hidden className="size-5" />
            </button>
            <FavoriteIconButton nftId={nft.id} name={nft.name} className="relative z-10" />
            <Link
              to="/nft/$nftId"
              params={{ nftId: nft.id }}
              aria-label={`Ver detalhes de ${nft.name}`}
              className="relative z-10 flex size-9 items-center justify-center rounded-sm bg-card/90 hover:text-primary"
              tabIndex={-1}
            >
              <Search aria-hidden className="size-5" />
            </Link>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-2 text-sm max-md:text-base md:px-0">
        <h3 id={`nft-${nft.id}-name`} className="font-normal">
          {/* link "esticado": o card inteiro é clicável, mas há um único destino no teclado */}
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring">
            {nft.name}
          </Link>
        </h3>
        <Price value={nft.price} compareAt={nft.compareAtPrice} />
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="skeleton aspect-[310/368] rounded-none" />
      <div className="skeleton h-4 w-2/3" />
      <div className="skeleton h-4 w-1/3" />
    </div>
  )
}
