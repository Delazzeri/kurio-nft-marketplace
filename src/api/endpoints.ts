/** Funções REST tipadas. Todas recebem `signal` quando são consultas (cancelamento de obsoletas). */
import { z } from 'zod'
import { request } from './client'
import {
  cartSchema,
  favoritesResponseSchema,
  nftDetailSchema,
  nftListResponseSchema,
  nftSummarySchema,
  orderSchema,
  profileSchema,
  quoteSchema,
  sessionSchema,
  walletSessionSchema,
  walletsResponseSchema,
  type AddCartItemInput,
  type CreateOrderInput,
  type LoginInput,
  type NetworkId,
  type NftListQuery,
  type ProfileInput,
  type RegisterInput,
  type WalletInput,
  type WalletSlot,
  type WalletType,
} from './contracts'

type Opts = { signal?: AbortSignal }

export const api = {
  auth: {
    login: (input: LoginInput) => request(sessionSchema, { method: 'POST', url: '/auth/login', data: input }),
    register: (input: RegisterInput) => request(sessionSchema, { method: 'POST', url: '/auth/register', data: input }),
    session: (o: Opts = {}) => request(sessionSchema, { method: 'GET', url: '/auth/session', signal: o.signal }),
    logout: () => request(z.unknown(), { method: 'POST', url: '/auth/logout' }),
  },

  nfts: {
    list: (q: NftListQuery, o: Opts = {}) =>
      request(nftListResponseSchema, {
        method: 'GET',
        url: '/nfts',
        signal: o.signal,
        params: {
          q: q.q,
          category: q.categories,
          network: q.networks,
          minPrice: q.minPrice,
          maxPrice: q.maxPrice,
          tab: q.tab,
          sort: q.sort,
          page: q.page,
          pageSize: q.pageSize,
        },
        // arrays como ?category=a&category=b
        paramsSerializer: { indexes: null },
      }),
    featured: (o: Opts = {}) =>
      request(z.object({ hero: z.array(nftSummarySchema), spotlight: nftSummarySchema }), {
        method: 'GET',
        url: '/nfts/featured',
        signal: o.signal,
      }),
    detail: (id: string, o: Opts = {}) =>
      request(nftDetailSchema, { method: 'GET', url: `/nfts/${encodeURIComponent(id)}`, signal: o.signal }),
    related: (id: string, o: Opts = {}) =>
      request(z.object({ items: z.array(nftSummarySchema) }), {
        method: 'GET',
        url: `/nfts/${encodeURIComponent(id)}/related`,
        signal: o.signal,
      }),
  },

  favorites: {
    list: (o: Opts = {}) => request(favoritesResponseSchema, { method: 'GET', url: '/me/favorites', signal: o.signal }),
    add: (nftId: string) => request(favoritesResponseSchema, { method: 'PUT', url: `/me/favorites/${nftId}` }),
    remove: (nftId: string) => request(favoritesResponseSchema, { method: 'DELETE', url: `/me/favorites/${nftId}` }),
  },

  cart: {
    get: (o: Opts = {}) => request(cartSchema, { method: 'GET', url: '/cart', signal: o.signal }),
    add: (input: AddCartItemInput) => request(cartSchema, { method: 'POST', url: '/cart/items', data: input }),
    update: (itemId: string, quantity: number) =>
      request(cartSchema, { method: 'PATCH', url: `/cart/items/${itemId}`, data: { quantity } }),
    remove: (itemId: string) => request(cartSchema, { method: 'DELETE', url: `/cart/items/${itemId}` }),
    acknowledge: (itemId: string) => request(cartSchema, { method: 'POST', url: `/cart/items/${itemId}/acknowledge` }),
    applyCoupon: (code: string) => request(cartSchema, { method: 'POST', url: '/cart/coupon', data: { code } }),
    removeCoupon: () => request(cartSchema, { method: 'DELETE', url: '/cart/coupon' }),
    merge: (guestCartId: string) => request(cartSchema, { method: 'POST', url: '/cart/merge', data: { guestCartId } }),
  },

  quotes: {
    create: (network: NetworkId, o: Opts = {}) =>
      request(quoteSchema, { method: 'POST', url: '/quotes', data: { network }, signal: o.signal }),
  },

  walletSessions: {
    connect: (walletId: string, network: NetworkId, provider: WalletType) =>
      request(walletSessionSchema, { method: 'POST', url: '/wallet-sessions', data: { walletId, network, provider } }),
    disconnect: (id: string) => request(z.unknown(), { method: 'DELETE', url: `/wallet-sessions/${id}` }),
  },

  orders: {
    create: (input: CreateOrderInput, idempotencyKey: string) =>
      request(orderSchema, { method: 'POST', url: '/orders', data: input, headers: { 'Idempotency-Key': idempotencyKey } }),
    get: (id: string, o: Opts = {}) => request(orderSchema, { method: 'GET', url: `/orders/${id}`, signal: o.signal }),
    list: (status?: string, o: Opts = {}) =>
      request(z.object({ items: z.array(orderSchema) }), { method: 'GET', url: '/orders', params: { status }, signal: o.signal }),
  },

  profile: {
    get: (o: Opts = {}) => request(profileSchema, { method: 'GET', url: '/me/profile', signal: o.signal }),
    update: (input: ProfileInput) => request(profileSchema, { method: 'PATCH', url: '/me/profile', data: input }),
    setAvatar: (dataUrl: string) => request(profileSchema, { method: 'PUT', url: '/me/avatar', data: { dataUrl } }),
    removeAvatar: () => request(profileSchema, { method: 'DELETE', url: '/me/avatar' }),
    changePassword: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      request(z.unknown(), { method: 'POST', url: '/me/password', data: input }),
  },

  wallets: {
    get: (o: Opts = {}) => request(walletsResponseSchema, { method: 'GET', url: '/me/wallets', signal: o.signal }),
    save: (slot: WalletSlot, input: WalletInput) =>
      request(walletsResponseSchema, { method: 'PUT', url: `/me/wallets/${slot}`, data: input }),
    mirrorPrimary: () =>
      request(walletsResponseSchema, { method: 'PUT', url: '/me/wallets/secondary', data: { sameAsPrimary: true } }),
    removeSecondary: () => request(walletsResponseSchema, { method: 'DELETE', url: '/me/wallets/secondary' }),
  },
}
