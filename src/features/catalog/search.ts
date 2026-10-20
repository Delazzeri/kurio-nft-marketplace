import {
  catalogTabIds,
  categoryIds,
  networkIds,
  sortIds,
  type CatalogTab,
  type CategoryId,
  type NetworkId,
  type SortId,
} from '@/api/constants'
import type { NftListQuery } from '@/api/contracts'

/**
 * Estado do catálogo na URL — sobrevive a refresh, compartilhamento e histórico.
 * Parâmetros inválidos são descartados em vez de quebrar a página.
 * (Parser sem dependências: roda na resolução da rota, antes da primeira pintura.)
 */
export interface CatalogSearch {
  q?: string
  cat?: CategoryId[]
  net?: NetworkId[]
  min?: string
  max?: string
  tab?: CatalogTab
  sort?: SortId
  page?: number
}

const oneOf = <T extends string>(values: readonly T[], v: unknown): T | undefined =>
  typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : undefined

const listOf = <T extends string>(values: readonly T[], v: unknown): T[] | undefined => {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []
  const valid = [...new Set(raw.filter((x): x is T => (values as readonly string[]).includes(String(x))))].sort()
  return valid.length ? valid : undefined
}

const eth = (v: unknown) => {
  const s = typeof v === 'number' ? String(v) : v
  return typeof s === 'string' && /^\d+(\.\d+)?$/.test(s) ? s : undefined
}

export function parseCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const q = typeof raw.q === 'string' ? raw.q.trim().slice(0, 80) : ''
  const page = Number(raw.page)
  return {
    q: q || undefined,
    cat: listOf(categoryIds, raw.cat),
    net: listOf(networkIds, raw.net),
    min: eth(raw.min),
    max: eth(raw.max),
    tab: oneOf(catalogTabIds, raw.tab),
    sort: oneOf(sortIds, raw.sort),
    page: Number.isInteger(page) && page > 0 ? page : undefined,
  }
}

export const PAGE_SIZE = 9

export function toApiQuery(s: CatalogSearch): NftListQuery {
  return {
    q: s.q,
    categories: s.cat,
    networks: s.net,
    minPrice: s.min,
    maxPrice: s.max,
    tab: s.tab && s.tab !== 'all' ? s.tab : undefined,
    sort: s.sort ?? 'recent',
    page: s.page ?? 1,
    pageSize: PAGE_SIZE,
  }
}
