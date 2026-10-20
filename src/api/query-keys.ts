import type { NetworkId, NftListQuery } from './contracts'

/**
 * Chaves do TanStack Query.
 * - Dados públicos ficam sob ['nfts'].
 * - Dados privados ficam sob ['private', userId, ...] → isolamento por usuário e limpeza
 *   em bloco no logout/troca de usuário.
 * - Carrinho/cotação são chaveados pelo dono (userId ou id do carrinho visitante).
 */
export const qk = {
  nfts: {
    all: ['nfts'] as const,
    list: (q: NftListQuery) => ['nfts', 'list', q] as const,
    featured: ['nfts', 'featured'] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
    related: (id: string) => ['nfts', 'related', id] as const,
  },
  cart: (owner: string) => ['cart', owner] as const,
  cartAll: ['cart'] as const,
  quote: (owner: string, cartVersion: number, network: NetworkId) => ['quote', owner, cartVersion, network] as const,
  quoteAll: ['quote'] as const,
  private: {
    all: ['private'] as const,
    user: (userId: string) => ['private', userId] as const,
    favorites: (userId: string) => ['private', userId, 'favorites'] as const,
    profile: (userId: string) => ['private', userId, 'profile'] as const,
    wallets: (userId: string) => ['private', userId, 'wallets'] as const,
    order: (userId: string, id: string) => ['private', userId, 'orders', id] as const,
    orders: (userId: string) => ['private', userId, 'orders'] as const,
  },
}
