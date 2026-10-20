import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Cart, NftDetail, NftListResponse, NftSummary, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { qk } from '@/api/query-keys'
import { announce } from '@/lib/announce'
import { compareEth, formatEth } from '@/lib/eth'

/** Após a confirmação do próprio pedido, a baixa de estoque não deve gerar alerta no carrinho. */
let suppressCartAlertsUntil = 0

function patchSummary<T extends NftSummary>(item: T, event: NftUpdatedEvent): T {
  if (item.id !== event.resource.id || item.version >= event.version) return item
  return { ...item, price: event.data.price, available: event.data.available, version: event.version }
}

/** Aplica nft.updated em todos os caches que exibem o NFT (catálogo, destaque, detalhe, relacionados). */
export function applyNftUpdated(client: QueryClient, event: NftUpdatedEvent) {
  const id = event.resource.id

  client.setQueryData<NftDetail>(qk.nfts.detail(id), (prev) => {
    if (!prev || prev.version >= event.version) return prev
    return {
      ...prev,
      price: event.data.price,
      available: event.data.available,
      version: event.version,
      editions: prev.editions.map((e) => {
        const next = event.data.editions.find((x) => x.id === e.id)
        return next ? { ...e, price: next.price, available: next.available } : e
      }),
    }
  })

  client.setQueriesData<NftListResponse>({ queryKey: ['nfts', 'list'] }, (prev) =>
    prev ? { ...prev, items: prev.items.map((i) => patchSummary(i, event)) } : prev,
  )
  client.setQueriesData<{ items: NftSummary[] }>({ queryKey: ['nfts', 'related'] }, (prev) =>
    prev ? { ...prev, items: prev.items.map((i) => patchSummary(i, event)) } : prev,
  )
  client.setQueryData<{ hero: NftSummary[]; spotlight: NftSummary }>(qk.nfts.featured, (prev) =>
    prev ? { hero: prev.hero.map((i) => patchSummary(i, event)), spotlight: patchSummary(prev.spotlight, event) } : prev,
  )

  // carrinho: o servidor recalcula preço/disponibilidade e sinaliza PRICE_CHANGED/SOLD_OUT
  const carts = client.getQueriesData<Cart>({ queryKey: qk.cartAll })
  const inCart = carts.flatMap(([, cart]) => cart?.items ?? []).filter((i) => i.nftId === id)
  if (inCart.length > 0) {
    void client.invalidateQueries({ queryKey: qk.cartAll })
    void client.invalidateQueries({ queryKey: qk.quoteAll })
    const item = inCart[0]!
    const edition = event.data.editions.find((e) => e.id === item.editionId)
    if (edition) {
      const priceChanged = compareEth(edition.price, item.unitPrice) !== 0
      const soldOut = edition.available === 0
      const short = !soldOut && edition.available < item.quantity
      const message = soldOut
        ? `${item.name} (${item.editionLabel}) esgotou. Atualizamos seu carrinho.`
        : short
          ? `Restam ${edition.available} unidade(s) de ${item.name} (${item.editionLabel}).`
          : priceChanged
            ? `O preço de ${item.name} (${item.editionLabel}) mudou de ${formatEth(item.unitPrice)} para ${formatEth(edition.price)}.`
            : null
      if (message && Date.now() > suppressCartAlertsUntil) {
        toast.warning(message, { id: `nft-${id}` })
        announce(message, 'assertive')
      }
    }
  }
}

export function applyOrderUpdated(client: QueryClient, event: OrderUpdatedEvent, currentUserId: string | null) {
  // isolamento: eventos de outro usuário/sessão anterior são ignorados
  if (!currentUserId || event.userId !== currentUserId) return false
  const key = qk.private.order(currentUserId, event.resource.id)
  const cached = client.getQueryData<Order>(key)
  // o evento só sinaliza a mudança; o snapshot completo (hash, recibo) vem do REST,
  // evitando exibir "confirmado" sem os dados da transação
  if (!cached || cached.version < event.version) void client.invalidateQueries({ queryKey: key })
  void client.invalidateQueries({ queryKey: qk.private.orders(currentUserId), exact: true })
  if (event.data.status === 'confirmed') suppressCartAlertsUntil = Date.now() + 3000
  if (event.data.status !== 'pending') {
    void client.invalidateQueries({ queryKey: qk.cartAll })
    void client.invalidateQueries({ queryKey: qk.quoteAll })
  }
  return true
}
