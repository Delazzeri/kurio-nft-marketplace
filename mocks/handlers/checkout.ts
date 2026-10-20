import Big from 'big.js'
import { HttpResponse, delay, http } from 'msw'
import { z } from 'zod'
import { createOrderInputSchema, networkIds, walletTypes, type OrderUpdatedEvent } from '@/api/contracts'
import {
  buildQuote,
  bus,
  db,
  findNft,
  isQuoteCurrent,
  paymentDelay,
  persist,
  publicOrder,
  settleDueOrders,
  updateNftEdition,
  userCart,
  type StoredOrder,
} from '../db'
import { API, apiError, authenticate, parseBody, withNetwork } from '../http'

/** Serialização estável para comparar conteúdo de tentativas com a mesma chave. */
function stableHash(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sort(x)]))
        : v
  return JSON.stringify(sort(value))
}

function userWallets(userId: string) {
  const w = db.state.wallets[userId]
  return [w?.primary, w?.secondary].filter((x): x is NonNullable<typeof x> => !!x)
}

export const checkoutHandlers = [
  /* -------- Conexão simulada de carteira (conectar / recusar / desconectar) -------- */
  http.post(
    `${API}/wallet-sessions`,
    withNetwork(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const body = await parseBody(request, z.object({ walletId: z.string(), network: z.enum(networkIds) }))
      if (!body.ok) return body.response
      const wallet = userWallets(auth.user.id).find((w) => w.id === body.data.walletId)
      if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
      if (db.scenario.flags?.walletRejected) {
        return apiError(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira. Tente novamente.')
      }
      const record = {
        id: db.nextId('ws'),
        userId: auth.user.id,
        walletId: wallet.id,
        network: body.data.network,
        address: wallet.address,
        connectedAt: new Date().toISOString(),
      }
      db.state.walletSessions[record.id] = record
      persist()
      const { userId: _u, ...pub } = record
      return HttpResponse.json({ ...pub, status: 'connected' }, { status: 201 })
    }),
  ),

  http.delete(
    `${API}/wallet-sessions/:id`,
    withNetwork(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const record = db.state.walletSessions[String(params.id)]
      if (record && record.userId === auth.user.id) {
        delete db.state.walletSessions[record.id]
        persist()
      }
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  /* -------- Pedidos (criação idempotente) -------- */
  http.post(
    `${API}/orders`,
    withNetwork(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const key = request.headers.get('idempotency-key')
      if (!key || key.length < 8) return apiError(400, 'VALIDATION_ERROR', 'Header Idempotency-Key obrigatório.')
      const body = await parseBody(request, createOrderInputSchema)
      if (!body.ok) return body.response
      const requestHash = stableHash(body.data)
      const scopedKey = `${auth.user.id}:${key}`

      // mesma tentativa → mesmo pedido; mesma chave com outro conteúdo → conflito
      const existingId = db.state.idempotency[scopedKey]
      if (existingId) {
        const existing = db.state.orders[existingId]!
        if (existing.requestHash !== requestHash) {
          return apiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
        }
        settleDueOrders()
        return HttpResponse.json(publicOrder(existing), { status: 200, headers: { 'Idempotent-Replayed': 'true' } })
      }

      const quote = db.state.quotes[body.data.quoteId]
      const cart = userCart(auth.user.id)
      if (!quote || quote.cartId !== cart.id) return apiError(404, 'NOT_FOUND', 'Cotação não encontrada. Atualize o resumo do pedido.')

      const walletSession = db.state.walletSessions[body.data.walletSessionId]
      if (!walletSession || walletSession.userId !== auth.user.id || walletSession.walletId !== body.data.walletId) {
        return apiError(409, 'CONFLICT', 'A carteira foi desconectada. Conecte novamente para continuar.')
      }
      const wallet = userWallets(auth.user.id).find((w) => w.id === body.data.walletId)
      if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')

      // cenários "durante a compra": alteram o catálogo e publicam nft.updated
      const first = quote.items[0]
      if (first && db.scenario.flags?.priceChangeOnCheckout && !db.state.scenarioOnce.priceChange) {
        db.state.scenarioOnce.priceChange = true
        const edition = findNft(first.nftId)?.editions.find((e) => e.id === first.editionId)
        if (edition) updateNftEdition(first.nftId, first.editionId, { price: new Big(edition.price).plus('0.10').toFixed(2) })
      }
      if (first && db.scenario.flags?.soldOutOnCheckout && !db.state.scenarioOnce.soldOut) {
        db.state.scenarioOnce.soldOut = true
        updateNftEdition(first.nftId, first.editionId, { available: 0 })
      }

      if (!isQuoteCurrent(quote)) {
        const fresh = buildQuote(cart, body.data.network)
        return apiError(409, 'QUOTE_STALE', 'Preço, disponibilidade ou taxas mudaram. Revise o pedido e confirme novamente.', {
          details: { quote: fresh },
        })
      }
      if (quote.network !== body.data.network) {
        return apiError(409, 'QUOTE_STALE', 'A rede mudou desde a cotação. Revise o pedido.', {
          details: { quote: buildQuote(cart, body.data.network) },
        })
      }

      const now = Date.now()
      const order: StoredOrder = {
        id: db.nextId('ord'),
        status: 'pending',
        declineReason: null,
        version: 1,
        idempotencyKey: key,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        receipt: {
          items: quote.items,
          subtotal: quote.subtotal,
          discount: quote.discount,
          networkFee: quote.networkFee,
          total: quote.total,
          coupon: quote.coupon,
          network: quote.network,
          wallet: {
            id: wallet.id,
            label: walletTypes.find((t) => t.id === wallet.walletType)?.label ?? wallet.walletType,
            address: wallet.address,
          },
          buyer: { displayName: body.data.buyer.displayName, email: body.data.buyer.email },
        },
        transaction: null,
        userId: auth.user.id,
        requestHash,
        cartId: cart.id,
        settleAt: now + paymentDelay(),
        walletType: wallet.walletType,
      }
      db.state.orders[order.id] = order
      db.state.idempotency[scopedKey] = order.id
      persist()
      const created: OrderUpdatedEvent = {
        type: 'order.updated',
        eventId: db.nextId('evt'),
        occurredAt: order.createdAt,
        version: order.version,
        resource: { type: 'order', id: order.id },
        userId: order.userId,
        data: { status: 'pending', declineReason: null },
      }
      bus.publish(created)

      if (db.scenario.flags?.orderTimeout && !db.state.scenarioOnce.orderTimeout) {
        db.state.scenarioOnce.orderTimeout = true
        persist()
        // pedido já existe, mas a resposta chega depois do timeout do cliente (10 s)
        await delay(15_000)
      }
      return HttpResponse.json(publicOrder(order), { status: 201 })
    }),
  ),

  http.get(
    `${API}/orders`,
    withNetwork(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      settleDueOrders()
      const status = new URL(request.url).searchParams.get('status')
      const items = Object.values(db.state.orders)
        .filter((o) => o.userId === auth.user.id && (!status || o.status === status))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map(publicOrder)
      return HttpResponse.json({ items })
    }),
  ),

  http.get(
    `${API}/orders/:id`,
    withNetwork(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      settleDueOrders()
      const order = db.state.orders[String(params.id)]
      if (!order) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado.')
      if (order.userId !== auth.user.id) return apiError(403, 'FORBIDDEN', 'Você não tem permissão para ver este pedido.')
      return HttpResponse.json(publicOrder(order))
    }),
  ),
]
