/**
 * Constantes de domínio (sem zod) — usadas pelo shell do app (rotas, footer, filtros) sem
 * carregar a biblioteca de validação na primeira pintura. Os schemas em contracts.ts as reutilizam.
 */
export const categories = [
  { id: 'arte-digital', label: 'Arte digital' },
  { id: 'fotografia', label: 'Fotografia' },
  { id: 'musica', label: 'Música' },
  { id: 'arte-3d', label: 'Arte 3D' },
  { id: 'colecionaveis', label: 'Colecionáveis' },
  { id: 'generativa', label: 'Generativa' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'assinaturas', label: 'Assinaturas' },
  { id: 'utilidade', label: 'Utilidade' },
] as const
export const categoryIds = categories.map((c) => c.id) as [CategoryId, ...CategoryId[]]
export type CategoryId = (typeof categories)[number]['id']

export const networks = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'solana', label: 'Solana' },
] as const
export type NetworkId = (typeof networks)[number]['id']
export const networkIds = networks.map((n) => n.id) as [NetworkId, ...NetworkId[]]

export const sortOptions = [
  { id: 'recent', label: 'Listados recentemente' },
  { id: 'price-asc', label: 'Menor preço' },
  { id: 'price-desc', label: 'Maior preço' },
  { id: 'popular', label: 'Mais populares' },
  { id: 'name', label: 'Nome (A–Z)' },
] as const
export type SortId = (typeof sortOptions)[number]['id']
export const sortIds = sortOptions.map((s) => s.id) as [SortId, ...SortId[]]

export const catalogTabs = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
] as const
export type CatalogTab = (typeof catalogTabs)[number]['id']
export const catalogTabIds = catalogTabs.map((t) => t.id) as [CatalogTab, ...CatalogTab[]]

export const walletTypes = [
  { id: 'metamask', label: 'MetaMask' },
  { id: 'walletconnect', label: 'WalletConnect' },
  { id: 'coinbase', label: 'Coinbase Wallet' },
] as const
export type WalletType = (typeof walletTypes)[number]['id']
export const walletTypeIds = walletTypes.map((w) => w.id) as [WalletType, ...WalletType[]]
