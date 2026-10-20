import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ShoppingCart, Trash2 } from 'lucide-react'
import type { CartItem } from '@/api/contracts'
import { Price } from '@/components/Price'
import { QuantityStepper } from '@/components/QuantityStepper'
import { EmptyState, ErrorState } from '@/components/states'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { CouponForm } from '@/features/cart/CouponForm'
import { OrderTotals } from '@/features/cart/OrderTotals'
import { useAcknowledgePrice, useCart, useQuote, useRemoveCartItem, useUpdateCartItem } from '@/features/cart/queries'
import { useNftList } from '@/features/catalog/queries'
import { RelatedCarousel } from '@/features/catalog/RelatedCarousel'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/carrinho')({
  head: () => ({ meta: [{ title: 'Carrinho — Kurio' }] }),
  component: CartPage,
})

const MAX_PER_ITEM = 10

function ItemIssues({ item }: { item: CartItem }) {
  const acknowledge = useAcknowledgePrice()
  const update = useUpdateCartItem()
  if (item.issues.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5 border-t border-[#3f2319] px-4 py-2 text-xs" role="status">
      {item.issues.includes('SOLD_OUT') && (
        <p className="flex items-center gap-1.5 text-destructive">
          <AlertTriangle aria-hidden className="size-3.5" /> Esta edição esgotou. Remova o item para continuar.
        </p>
      )}
      {item.issues.includes('INSUFFICIENT_AVAILABILITY') && (
        <p className="flex flex-wrap items-center gap-2 text-destructive">
          <AlertTriangle aria-hidden className="size-3.5" /> Restam apenas {item.available} unidade(s).
          <Button size="xs" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ itemId: item.id, quantity: item.available })}>
            Ajustar para {item.available}
          </Button>
        </p>
      )}
      {item.issues.includes('PRICE_CHANGED') && (
        <p className="flex flex-wrap items-center gap-2 text-price">
          <AlertTriangle aria-hidden className="size-3.5" /> Preço alterado de {formatEth(item.acknowledgedPrice)} para {formatEth(item.unitPrice)}.
          <Button size="xs" variant="outline" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(item.id)}>
            Ok, entendi
          </Button>
        </p>
      )}
    </div>
  )
}

function CartRow({ item }: { item: CartItem }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const max = Math.max(item.quantity, Math.min(item.available, MAX_PER_ITEM))
  return (
    <li className={cn('bg-card', item.issues.length > 0 && 'ring-1 ring-price/50')} data-testid={`cart-item-${item.nftId}`}>
      <div className="grid grid-cols-[70px_1fr_auto] items-center gap-x-4 gap-y-3 md:grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_48px] md:gap-4">
        <div className="col-span-2 flex items-center gap-4 md:col-span-1">
          <img src={item.image} alt={item.imageAlt} width={70} height={70} loading="lazy" className="size-[70px] object-cover" />
          <div className="min-w-0">
            <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="block truncate font-bold hover:text-primary">
              {item.name}
            </Link>
            <p className="text-sm text-muted-foreground">ID do token: {item.tokenId}</p>
            <p className="text-xs text-muted-foreground">Edição {item.editionLabel}</p>
          </div>
        </div>
        <div className="row-start-1 justify-self-end pr-2 md:hidden">
          <Button size="icon-sm" variant="ghost" aria-label={`Remover ${item.name} do carrinho`} disabled={remove.isPending} onClick={() => remove.mutate({ itemId: item.id, name: item.name })}>
            <Trash2 />
          </Button>
        </div>
        <div className="pl-4 md:pl-0">
          <span className="sr-only md:hidden">Preço unitário: </span>
          <span className="font-semibold text-muted-foreground">{formatEth(item.unitPrice)}</span>
        </div>
        <div className={cn(update.isPending && 'opacity-60')}>
          <QuantityStepper
            size="sm"
            value={item.quantity}
            max={max}
            disabled={update.isPending || item.issues.includes('SOLD_OUT')}
            onChange={(quantity) => update.mutate({ itemId: item.id, quantity })}
            label={`Quantidade de ${item.name}`}
          />
        </div>
        <div className="col-span-3 pb-3 pl-4 md:col-span-1 md:pb-0 md:pl-0">
          <span className="sr-only">Total do item: </span>
          <Price value={item.lineTotal} />
        </div>
        <div className="hidden md:block">
          <Button size="icon-sm" variant="ghost" aria-label={`Remover ${item.name} do carrinho`} disabled={remove.isPending} onClick={() => remove.mutate({ itemId: item.id, name: item.name })}>
            <Trash2 />
          </Button>
        </div>
      </div>
      <ItemIssues item={item} />
    </li>
  )
}

function CartPage() {
  const navigate = useNavigate()
  const { data: cart, isPending, error, refetch, isFetching } = useCart()
  const quote = useQuote('ethereum', cart)
  const popular = useNftList({ sort: 'popular', page: 1, pageSize: 10 })
  const hasIssues = !!cart?.items.some((i) => i.issues.length > 0)
  const blocked = hasIssues || !quote.data || quote.isFetching || quote.data.blockingIssues.length > 0

  return (
    <>
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
              <BreadcrumbPage className="font-semibold text-foreground">Carrinho</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="sr-only">Carrinho de NFTs</h1>

        {isPending ? (
          <CartSkeleton />
        ) : !cart ? (
          <ErrorState className="mt-6" error={error} onRetry={() => void refetch()} retrying={isFetching} title="Não foi possível carregar o carrinho" />
        ) : cart.items.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="Seu carrinho está vazio"
              action={
                <Button asChild>
                  <Link to="/" hash="catalogo">
                    <ShoppingCart aria-hidden /> Explorar NFTs
                  </Link>
                </Button>
              }
            >
              Adicione NFTs do catálogo para vê-los aqui.
            </EmptyState>
          </div>
        ) : (
          <div className="mt-2 grid gap-10 lg:grid-cols-[1fr_332px] lg:gap-[86px]">
            <section aria-label="Itens do carrinho">
              <div aria-hidden className="hidden grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_48px] gap-4 border-b border-border pb-3 font-bold md:grid">
                <span>NFTs</span>
                <span>Preço</span>
                <span>Edições</span>
                <span>Total</span>
                <span />
              </div>
              <ul className="mt-3 flex flex-col gap-3" aria-busy={isFetching}>
                {cart.items.map((item) => (
                  <CartRow key={item.id} item={item} />
                ))}
              </ul>
            </section>

            <aside aria-labelledby="resumo-titulo" className="flex flex-col gap-6">
              <h2 id="resumo-titulo" className="border-b border-border pb-3 text-lg font-bold">
                Resumo da carteira
              </h2>
              <CouponForm cart={cart} />
              {quote.isError && !quote.data ? (
                <ErrorState error={quote.error} onRetry={() => void quote.refetch()} retrying={quote.isFetching} title="Não foi possível calcular os totais" />
              ) : (
                <OrderTotals quote={quote.data} loading={quote.isFetching} />
              )}
              {quote.data && quote.data.blockingIssues.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm text-destructive" role="alert">
                  {quote.data.blockingIssues.map((i) => (
                    <li key={i.cartItemId}>{i.message}</li>
                  ))}
                </ul>
              )}
              <Button size="lg" className="w-full" disabled={blocked} onClick={() => void navigate({ to: '/pagamento' })}>
                Conectar e finalizar
              </Button>
              {hasIssues && <p className="-mt-3 text-center text-xs text-price">Revise os avisos dos itens para continuar.</p>}
              <Link to="/" hash="catalogo" className="text-center text-primary hover:underline">
                Continuar explorando
              </Link>
            </aside>
          </div>
        )}
      </div>
      <RelatedCarousel title="Colecionadores também viram" items={popular.data?.items} loading={popular.isPending} />
    </>
  )
}

function CartSkeleton() {
  return (
    <div className="mt-2 grid gap-10 lg:grid-cols-[1fr_332px] lg:gap-[86px]" aria-busy="true" aria-label="Carregando carrinho" data-testid="cart-skeleton">
      <div className="flex flex-col gap-3">
        <div className="skeleton h-8" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton h-[70px]" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="skeleton h-8" />
        <div className="skeleton h-10" />
        <OrderTotals quote={undefined} />
        <div className="skeleton h-12" />
      </div>
    </div>
  )
}
