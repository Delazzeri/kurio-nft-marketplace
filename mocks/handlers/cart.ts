import { HttpResponse, http } from 'msw'
import { z } from 'zod'
import { addCartItemInputSchema, networkIds } from '@/api/contracts'
import { buildQuote, cartView, db, findNft, getOrCreateCart, maxQuantity, mergeCarts, touchCart, userCart, type StoredCart } from '../db'
import { API, apiError, authenticate, optionalAuth, parseBody, withNetwork } from '../http'
import { coupons } from '../seed'

/** Carrinho do usuário autenticado ou do visitante (header X-Cart-Id). */
function resolveCart(request: Request): { ok: true; cart: StoredCart } | { ok: false; response: Response } {
  const auth = optionalAuth(request)
  if (!auth.ok) return auth
  if (auth.user) return { ok: true, cart: userCart(auth.user.id) }
  const guestId = request.headers.get('x-cart-id')
  if (!guestId || !/^gc_[a-z0-9-]{8,}$/i.test(guestId)) {
    return { ok: false, response: apiError(400, 'VALIDATION_ERROR', 'Identificador do carrinho ausente.') }
  }
  return { ok: true, cart: getOrCreateCart(guestId, null) }
}

export const cartHandlers = [
  http.get(
    `${API}/cart`,
    withNetwork(({ request }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      return HttpResponse.json(cartView(r.cart))
    }),
  ),

  http.post(
    `${API}/cart/items`,
    withNetwork(async ({ request }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      const body = await parseBody(request, addCartItemInputSchema)
      if (!body.ok) return body.response
      const { nftId, editionId, quantity } = body.data
      const nft = findNft(nftId)
      const edition = nft?.editions.find((e) => e.id === editionId)
      if (!nft || !edition) return apiError(404, 'NOT_FOUND', 'NFT ou edição não encontrada.')
      const existing = r.cart.items.find((i) => i.nftId === nftId && i.editionId === editionId)
      const next = (existing?.quantity ?? 0) + quantity
      const max = maxQuantity(edition.available)
      if (edition.available === 0) {
        return apiError(409, 'AVAILABILITY_CONFLICT', `A edição ${edition.label} está esgotada.`, { details: { available: 0 } })
      }
      if (next > max) {
        return apiError(409, 'AVAILABILITY_CONFLICT', `Limite de ${max} unidade(s) para esta edição${existing ? ` (você já tem ${existing.quantity} no carrinho)` : ''}.`, {
          details: { available: edition.available, max, inCart: existing?.quantity ?? 0 },
        })
      }
      if (existing) {
        existing.quantity = next
        existing.acknowledgedPrice = edition.price
      } else {
        r.cart.items.push({ id: db.nextId('ci'), nftId, editionId, quantity, acknowledgedPrice: edition.price })
      }
      touchCart(r.cart)
      return HttpResponse.json(cartView(r.cart), { status: 201 })
    }),
  ),

  http.patch(
    `${API}/cart/items/:itemId`,
    withNetwork(async ({ request, params }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      const body = await parseBody(request, z.object({ quantity: z.number().int().positive('Quantidade mínima é 1') }))
      if (!body.ok) return body.response
      const item = r.cart.items.find((i) => i.id === params.itemId)
      if (!item) return apiError(404, 'NOT_FOUND', 'Item não encontrado no carrinho.')
      const edition = findNft(item.nftId)?.editions.find((e) => e.id === item.editionId)
      if (!edition) return apiError(404, 'NOT_FOUND', 'Edição não encontrada.')
      const max = maxQuantity(edition.available)
      if (body.data.quantity > max) {
        return apiError(409, 'AVAILABILITY_CONFLICT', max === 0 ? 'Esta edição esgotou.' : `Máximo de ${max} unidade(s) disponível(is).`, {
          details: { available: edition.available, max },
        })
      }
      item.quantity = body.data.quantity
      touchCart(r.cart)
      return HttpResponse.json(cartView(r.cart))
    }),
  ),

  http.delete(
    `${API}/cart/items/:itemId`,
    withNetwork(({ request, params }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      const before = r.cart.items.length
      r.cart.items = r.cart.items.filter((i) => i.id !== params.itemId)
      if (r.cart.items.length === before) return apiError(404, 'NOT_FOUND', 'Item não encontrado no carrinho.')
      touchCart(r.cart)
      return HttpResponse.json(cartView(r.cart))
    }),
  ),

  /** Usuário reconhece o novo preço exibido (limpa o aviso PRICE_CHANGED). */
  http.post(
    `${API}/cart/items/:itemId/acknowledge`,
    withNetwork(({ request, params }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      const item = r.cart.items.find((i) => i.id === params.itemId)
      const edition = item && findNft(item.nftId)?.editions.find((e) => e.id === item.editionId)
      if (!item || !edition) return apiError(404, 'NOT_FOUND', 'Item não encontrado no carrinho.')
      item.acknowledgedPrice = edition.price
      touchCart(r.cart)
      return HttpResponse.json(cartView(r.cart))
    }),
  ),

  http.post(
    `${API}/cart/coupon`,
    withNetwork(async ({ request }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      const body = await parseBody(request, z.object({ code: z.string().trim().min(1, 'Informe o código promocional') }))
      if (!body.ok) return body.response
      const code = body.data.code.toUpperCase()
      const coupon = coupons[code]
      if (!coupon) return apiError(422, 'COUPON_INVALID', 'Código promocional inválido.', { fields: { code: 'Código promocional inválido.' } })
      if (coupon.expired) return apiError(422, 'COUPON_EXPIRED', 'Este código promocional expirou.', { fields: { code: 'Este código promocional expirou.' } })
      r.cart.couponCode = code
      touchCart(r.cart)
      return HttpResponse.json(cartView(r.cart))
    }),
  ),

  http.delete(
    `${API}/cart/coupon`,
    withNetwork(({ request }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      r.cart.couponCode = null
      touchCart(r.cart)
      return HttpResponse.json(cartView(r.cart))
    }),
  ),

  /** Ao autenticar, os itens do visitante são incorporados ao carrinho do usuário. */
  http.post(
    `${API}/cart/merge`,
    withNetwork(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const body = await parseBody(request, z.object({ guestCartId: z.string() }))
      if (!body.ok) return body.response
      const target = userCart(auth.user.id)
      const guest = db.state.carts[body.data.guestCartId]
      if (guest && !guest.userId && guest.id !== target.id) mergeCarts(guest, target)
      return HttpResponse.json(cartView(target))
    }),
  ),

  /** Cotação: valida cupom, disponibilidade, descontos, taxa de rede e total. */
  http.post(
    `${API}/quotes`,
    withNetwork(async ({ request }) => {
      const r = resolveCart(request)
      if (!r.ok) return r.response
      const body = await parseBody(request, z.object({ network: z.enum(networkIds).default('ethereum') }))
      if (!body.ok) return body.response
      return HttpResponse.json(buildQuote(r.cart, body.data.network), { status: 201 })
    }),
  ),
]
