import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Heart, Mail, Search, ShoppingCart, Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isApiError } from '@/api/errors'
import { networks } from '@/api/constants'
import type { Edition, NftDetail } from '@/api/contracts'
import { Price } from '@/components/Price'
import { QuantityStepper } from '@/components/QuantityStepper'
import { ErrorState, NotFound } from '@/components/states'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAddToCart, useCart } from '@/features/cart/queries'
import { useNftDetail, useRelated } from '@/features/catalog/queries'
import { RelatedCarousel } from '@/features/catalog/RelatedCarousel'
import { useFavoriteState } from '@/features/favorites/FavoriteButton'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import { useIsDesktop } from '@/lib/use-media'
import { cn } from '@/lib/utils'

const MAX_PER_ITEM = 10
const networkLabel = (id: string) => networks.find((n) => n.id === id)?.label ?? id

export const Route = createFileRoute('/nft/$nftId')({
  validateSearch: (raw: Record<string, unknown>): { edicao?: string } => ({
    edicao: typeof raw.edicao === 'string' && raw.edicao ? raw.edicao : undefined,
  }),
  loader: ({ context, params }) => {
    void import('@/features/catalog/queries').then(({ nftDetailQuery, relatedQuery }) => {
      void context.queryClient.prefetchQuery(nftDetailQuery(params.nftId))
      void context.queryClient.prefetchQuery(relatedQuery(params.nftId))
    })
  },
  staticData: { hideMobileTabs: true },
  component: NftDetailPage,
})

function NftDetailPage() {
  const { nftId } = Route.useParams()
  const { data: nft, isPending, error, refetch, isFetching } = useNftDetail(nftId)
  const related = useRelated(nftId)

  useEffect(() => {
    if (nft) document.title = `${nft.name} — Kurio`
  }, [nft])

  if (isPending) return <DetailSkeleton />
  if (error && isApiError(error) && error.status === 404) {
    return <NotFound title="NFT não encontrado" description="Este NFT não existe ou foi removido do catálogo." />
  }
  if (!nft) {
    return (
      <div className="container-page py-16">
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} title="Não foi possível carregar o NFT" />
      </div>
    )
  }
  return (
    <>
      <DetailBody nft={nft} />
      <RelatedCarousel title="Mais desta coleção" items={related.data?.items} loading={related.isPending} />
    </>
  )
}

function pickEdition(nft: NftDetail, requested?: string): Edition {
  return (
    nft.editions.find((e) => e.id === requested) ??
    nft.editions.find((e) => e.id === nft.defaultEditionId && e.available > 0) ??
    nft.editions.find((e) => e.available > 0) ??
    nft.editions.find((e) => e.id === nft.defaultEditionId)!
  )
}

function DetailBody({ nft }: { nft: NftDetail }) {
  const { edicao } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const edition = pickEdition(nft, edicao)
  const { data: cart } = useCart()
  const inCart = cart?.items.find((i) => i.nftId === nft.id && i.editionId === edition.id)?.quantity ?? 0
  const max = Math.max(0, Math.min(edition.available, MAX_PER_ITEM) - inCart)
  const [rawQty, setQty] = useState(1)
  // limite pode cair (evento em tempo real ou item já no carrinho): quantidade efetiva é derivada
  const qty = Math.max(1, Math.min(rawQty, max || 1))
  const [activeImage, setActiveImage] = useState(0)
  const addToCart = useAddToCart()
  const favorite = useFavoriteState(nft.id, nft.name)
  const soldOut = edition.available === 0
  const isDesktop = useIsDesktop()

  // preço alterado enquanto a página está aberta
  const lastPrice = useRef(edition.price)
  const [priceFlash, setPriceFlash] = useState(false)
  useEffect(() => {
    if (lastPrice.current !== edition.price) {
      announce(`Preço de ${nft.name} (${edition.label}) atualizado de ${formatEth(lastPrice.current)} para ${formatEth(edition.price)}.`, 'assertive')
      lastPrice.current = edition.price
      setPriceFlash(true)
      const t = setTimeout(() => setPriceFlash(false), 2500)
      return () => clearTimeout(t)
    }
  }, [edition.price, edition.label, nft.name])

  const selectEdition = (id: string) => {
    void navigate({ search: { edicao: id === nft.defaultEditionId ? undefined : id }, replace: true, resetScroll: false })
    setQty(1)
  }

  const buy = (goToCart: boolean) =>
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: qty, name: nft.name },
      { onSuccess: () => (goToCart ? void navigate({ to: '/carrinho' }) : undefined) },
    )

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const stockHint = soldOut
    ? `Edição ${edition.label} esgotada.`
    : max === 0
      ? `Você já tem o máximo permitido desta edição no carrinho.`
      : edition.available <= 5
        ? `Restam ${edition.available} unidade(s) desta edição.`
        : `Limite de ${Math.min(edition.available, MAX_PER_ITEM)} por pedido.`

  const editionPicker = (
    <fieldset>
      <legend className="mb-2 text-sm font-bold">Edição:</legend>
      <div role="radiogroup" aria-label="Edição" className="flex flex-wrap gap-2">
        {nft.editions.map((e) => {
          const selected = e.id === edition.id
          const unavailable = e.available === 0
          return (
            <button
              key={e.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Edição ${e.label}, ${formatEth(e.price)}${unavailable ? ', indisponível' : ''}`}
              onClick={() => selectEdition(e.id)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                selected ? 'border-primary bg-primary/15 text-price' : 'border-[#4f3421] hover:border-primary',
                unavailable && 'text-muted-foreground line-through',
              )}
            >
              {e.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )

  const meta = (
    <dl className="flex flex-col gap-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <dt>ID do token:</dt>
        <dd>{nft.tokenId}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Coleção:</dt>
        <dd>{nft.collection.name}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Rede:</dt>
        <dd>{nft.networks.map(networkLabel).join(' · ')}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Atributos:</dt>
        <dd>{nft.attributes.join(', ')}</dd>
      </div>
    </dl>
  )

  const buyButtonLabel = soldOut ? 'ESGOTADO' : addToCart.isPending ? 'ADICIONANDO…' : 'COMPRAR'

  return (
    <article aria-labelledby="nft-titulo">
      {/* ---------------- Mobile (frame Mobile / Detalhes do NFT) ---------------- */}
      {!isDesktop && (
      <div>
        <div className="relative bg-card px-7 pt-16 pb-0">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => (window.history.length > 1 ? router.history.back() : void navigate({ to: '/' }))}
            className="absolute top-6 left-7 flex size-9 items-center justify-center rounded-full border border-[#4f3421] bg-background/40"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            aria-pressed={favorite.isFavorite}
            aria-label={favorite.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
            onClick={favorite.onToggle}
            className="absolute top-6 right-7 flex size-9 items-center justify-center rounded-full border border-[#4f3421] bg-background/40"
          >
            <Heart aria-hidden className={cn('size-5 text-primary', favorite.isFavorite && 'fill-primary')} />
          </button>
          <img src={nft.gallery[0]?.src ?? nft.image} alt={nft.imageAlt} width={360} height={360} fetchPriority="high" className="aspect-square w-full rounded-t-2xl object-cover" />
        </div>
        <div className="-mt-4 flex flex-col gap-4 rounded-t-3xl bg-background px-6 pt-7 pb-40">
          <div className="flex items-start justify-between gap-3">
            <h1 id="nft-titulo" className="text-xl font-bold">
              {nft.name}
            </h1>
            <span role="img" className="inline-flex items-center gap-1 rounded-full border border-primary px-2 py-0.5 text-sm" aria-label={`Nota ${nft.rating} de 5, ${nft.reviewsCount} avaliações`}>
              <Star aria-hidden className="size-4 fill-primary text-primary" /> <b>{nft.rating}</b>({nft.reviewsCount})
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{nft.description}</p>
          {editionPicker}
          {meta}
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {stockHint}
          </p>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-4 rounded-t-3xl bg-card px-6 pt-5 pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm">Qtd.</span>
              <QuantityStepper size="sm" value={qty} max={max} onChange={setQty} label="Quantidade" disabled={soldOut || max === 0} />
            </div>
            <Price value={edition.price} className={cn('text-xl', priceFlash && 'animate-pulse')} />
          </div>
          <div className="flex gap-3">
            <Button size="lg" className="h-14 flex-1 rounded-full" disabled={soldOut || max === 0 || addToCart.isPending} onClick={() => buy(true)}>
              {soldOut ? 'Esgotado' : 'Comprar NFT'}
            </Button>
            <Button
              size="icon-lg"
              variant="secondary"
              className="size-14 rounded-full"
              aria-label="Adicionar ao carrinho"
              disabled={soldOut || max === 0 || addToCart.isPending}
              onClick={() => buy(false)}
            >
              <ShoppingCart aria-hidden className="text-primary" />
            </Button>
          </div>
        </div>
      </div>

      )}

      {/* ---------------- Desktop / tablet ---------------- */}
      {isDesktop && (
      <div className="container-page pt-6">
        <Breadcrumb>
          <BreadcrumbList className="text-sm font-semibold text-foreground">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Início</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" hash="catalogo">
                  Mercado
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-muted-foreground">{nft.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,573px)_1fr]">
          <div className="grid grid-cols-[100px_1fr] gap-6">
            <ul className="flex flex-col gap-4" aria-label="Galeria">
              {nft.gallery.map((g, i) => (
                <li key={i}>
                  <button
                    type="button"
                    aria-label={`Mostrar imagem ${i + 1} de ${nft.gallery.length}`}
                    aria-pressed={i === activeImage}
                    onClick={() => setActiveImage(i)}
                    className={cn('block overflow-hidden rounded-sm border-2', i === activeImage ? 'border-primary' : 'border-transparent')}
                  >
                    <img src={g.src} alt="" width={100} height={100} loading="lazy" className="aspect-square w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="relative bg-card p-5">
              <img
                src={nft.gallery[activeImage]?.src ?? nft.image}
                alt={nft.gallery[activeImage]?.alt ?? nft.imageAlt}
                width={410}
                height={410}
                fetchPriority="high"
                className="aspect-square w-full rounded-2xl object-cover"
              />
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" aria-label="Ampliar imagem" className="absolute top-6 right-6 flex size-9 items-center justify-center rounded-full bg-background/80 hover:text-primary">
                    <Search aria-hidden className="size-5" />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-[min(92vw,720px)] border-border bg-card p-4">
                  <DialogTitle className="text-base">{nft.name}</DialogTitle>
                  <DialogDescription className="sr-only">Imagem ampliada</DialogDescription>
                  <img src={nft.gallery[activeImage]?.src ?? nft.image} alt={nft.gallery[activeImage]?.alt ?? nft.imageAlt} className="w-full rounded-md" />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h1 id="nft-titulo-desktop" className="text-[28px] font-bold tracking-wide">
              {nft.name}
            </h1>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <span className={cn('rounded-sm transition-colors', priceFlash && 'bg-primary/20')}>
                <Price value={edition.price} compareAt={edition.compareAtPrice} className="text-xl" />
                {priceFlash && <span className="ml-2 text-xs text-price">Preço atualizado</span>}
              </span>
              <span role="img" className="flex items-center gap-1 text-sm" aria-label={`Nota ${nft.rating} de 5, ${nft.reviewsCount} avaliações de colecionadores`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} aria-hidden className="size-3.5 fill-primary text-primary" />
                ))}
                <span aria-hidden className="ml-1">
                  {nft.reviewsCount} avaliações de colecionadores
                </span>
              </span>
            </div>
            <h2 className="text-sm font-bold">Sobre este NFT:</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{nft.description}</p>
            {editionPicker}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <QuantityStepper value={qty} max={max} onChange={setQty} label="Quantidade" disabled={soldOut || max === 0} />
              <div className="flex gap-2">
                <Button className="w-[115px]" disabled={soldOut || max === 0 || addToCart.isPending} onClick={() => buy(true)}>
                  {buyButtonLabel}
                </Button>
                <Button variant="outline" aria-pressed={favorite.isFavorite} onClick={favorite.onToggle}>
                  <Heart aria-hidden className={cn(favorite.isFavorite && 'fill-primary')} />
                  {favorite.isFavorite ? 'Favoritado' : 'Favoritar'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {stockHint}
            </p>
            {meta}
            <div className="flex items-center gap-3 text-sm font-bold">
              Compartilhar este NFT:
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no LinkedIn (nova aba)" className="hover:text-primary">
                in
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(shareUrl)}`} aria-label="Compartilhar por e-mail" className="hover:text-primary">
                <Mail aria-hidden className="size-4" />
              </a>
              <a href={`https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no X (nova aba)" className="hover:text-primary">
                𝕏
              </a>
            </div>
          </div>
        </div>
      </div>

      )}

      <div className="container-page mt-10 md:mt-20">
        <Tabs defaultValue="detalhes">
          <TabsList className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border bg-transparent p-0 md:gap-8">
            <TabsTrigger value="detalhes" className="flex-none rounded-none border-0 border-b-2 border-transparent px-0 pb-2 text-base data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-primary">
              Detalhes do NFT
            </TabsTrigger>
            <TabsTrigger value="avaliacoes" className="flex-none rounded-none border-0 border-b-2 border-transparent px-0 pb-2 text-base data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-primary">
              <span className="md:hidden">Avaliações ({nft.reviewsCount})</span>
              <span className="max-md:hidden">Avaliações de colecionadores ({nft.reviewsCount})</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="detalhes" className="flex flex-col gap-4 pt-4 text-sm leading-relaxed">
            {nft.story.map((p, i) => (
              <p key={i} className="text-muted-foreground">
                {p}
              </p>
            ))}
            <div>
              <h3 className="font-bold">Rede:</h3>
              <p className="text-muted-foreground">
                Cunhado na {networkLabel(nft.network)} com procedência imutável e metadados armazenados no IPFS.
                {nft.networks.length > 1 && ` Também listado em ${nft.networks.slice(1).map(networkLabel).join(', ')} (multichain).`}
              </p>
            </div>
            <div>
              <h3 className="font-bold">Contrato:</h3>
              <p className="text-muted-foreground">{nft.royalties}</p>
            </div>
            <div>
              <h3 className="font-bold">Direitos autorais:</h3>
              <p className="text-muted-foreground">{nft.contract}</p>
            </div>
          </TabsContent>
          <TabsContent value="avaliacoes" className="pt-4 text-sm text-muted-foreground">
            Nota média {nft.rating} de 5 em {nft.reviewsCount} avaliações. A leitura das avaliações individuais não faz parte desta demonstração.
          </TabsContent>
        </Tabs>
      </div>
    </article>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-page pt-6" aria-busy="true" aria-label="Carregando NFT" data-testid="detail-skeleton">
      <div className="skeleton h-4 w-40" />
      <div className="mt-4 grid gap-8 md:grid-cols-[minmax(0,573px)_1fr]">
        <div className="grid grid-cols-[100px_1fr] gap-6">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton aspect-square" />
            ))}
          </div>
          <div className="skeleton aspect-square" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="skeleton h-8 w-2/3" />
          <div className="skeleton h-6 w-1/3" />
          <div className="skeleton h-20" />
          <div className="skeleton h-8 w-1/2" />
          <div className="skeleton h-10" />
          <div className="skeleton h-24" />
        </div>
      </div>
    </div>
  )
}
