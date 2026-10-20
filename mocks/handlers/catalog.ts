import Big from 'big.js'
import { HttpResponse, http } from 'msw'
import {
  categories,
  networks,
  nftListQuerySchema,
  type NftDetail,
  type NftListQuery,
  type NftListResponse,
} from '@/api/contracts'
import { db, findNft, toSummary } from '../db'
import { API, apiError, withNetwork } from '../http'
import { NEW_RELEASE_CUTOFF, TRENDING_THRESHOLD } from '../seed'

const DEFAULT_PAGE_SIZE = 9

function parseQuery(url: URL): NftListQuery | null {
  const p = url.searchParams
  const num = (v: string | null) => (v ? Number(v) : undefined)
  const result = nftListQuerySchema.safeParse({
    q: p.get('q') || undefined,
    categories: p.getAll('category').length ? p.getAll('category') : undefined,
    networks: p.getAll('network').length ? p.getAll('network') : undefined,
    minPrice: p.get('minPrice') || undefined,
    maxPrice: p.get('maxPrice') || undefined,
    tab: p.get('tab') || undefined,
    sort: p.get('sort') || undefined,
    page: num(p.get('page')),
    pageSize: num(p.get('pageSize')),
  })
  return result.success ? result.data : null
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

type Filter = (n: NftDetail) => boolean

function buildFilters(q: NftListQuery) {
  const price = (n: NftDetail) => new Big(toSummary(n).price)
  const filters: Record<'q' | 'tab' | 'price' | 'categories' | 'networks', Filter> = {
    q: (n) => {
      if (!q.q) return true
      const needle = normalize(q.q.trim())
      return [n.name, n.tokenId, n.collection.name, ...n.attributes].some((f) => normalize(f).includes(needle))
    },
    tab: (n) => {
      if (q.tab === 'new') return Date.parse(n.listedAt) >= NEW_RELEASE_CUTOFF
      if (q.tab === 'trending') return n.popularity >= TRENDING_THRESHOLD
      return true
    },
    price: (n) => {
      if (q.minPrice && price(n).lt(q.minPrice)) return false
      if (q.maxPrice && price(n).gt(q.maxPrice)) return false
      return true
    },
    categories: (n) => !q.categories?.length || q.categories.includes(n.category),
    networks: (n) => !q.networks?.length || q.networks.includes(n.network),
  }
  return filters
}

export const catalogHandlers = [
  http.get(
    `${API}/nfts`,
    withNetwork(({ request }) => {
      const url = new URL(request.url)
      const query = parseQuery(url)
      if (!query) return apiError(422, 'VALIDATION_ERROR', 'Parâmetros de busca inválidos.')

      const all = db.scenario.flags?.emptyCatalog ? [] : db.state.nfts
      const f = buildFilters(query)
      const applyExcept = (skip: keyof typeof f) =>
        all.filter((n) => (Object.keys(f) as (keyof typeof f)[]).every((k) => k === skip || f[k](n)))

      const matched = all.filter((n) => Object.values(f).every((fn) => fn(n)))
      const sort = query.sort ?? 'recent'
      const sorted = [...matched].sort((a, b) => {
        const pa = new Big(toSummary(a).price)
        const pb = new Big(toSummary(b).price)
        switch (sort) {
          case 'price-asc':
            return pa.cmp(pb) || a.name.localeCompare(b.name)
          case 'price-desc':
            return pb.cmp(pa) || a.name.localeCompare(b.name)
          case 'popular':
            return b.popularity - a.popularity
          case 'name':
            return a.name.localeCompare(b.name, 'pt-BR')
          default:
            return Date.parse(b.listedAt) - Date.parse(a.listedAt)
        }
      })

      const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
      const page = Math.min(query.page ?? 1, totalPages)
      const items = sorted.slice((page - 1) * pageSize, page * pageSize).map(toSummary)

      // facetas contam itens considerando os demais filtros (padrão de busca facetada)
      const forCategories = applyExcept('categories')
      const forNetworks = applyExcept('networks')
      const prices = all.map((n) => new Big(toSummary(n).price))
      const min = prices.length ? prices.reduce((a, b) => (a.lt(b) ? a : b)) : new Big(0)
      const max = prices.length ? prices.reduce((a, b) => (a.gt(b) ? a : b)) : new Big(0)

      const body: NftListResponse = {
        items,
        page,
        pageSize,
        total: sorted.length,
        totalPages,
        facets: {
          categories: categories.map((c) => ({ id: c.id, label: c.label, count: forCategories.filter((n) => n.category === c.id).length })),
          networks: networks.map((n) => ({ id: n.id, label: n.label, count: forNetworks.filter((x) => x.network === n.id).length })),
          priceRange: { min: min.toFixed(2), max: max.toFixed(2) },
        },
        appliedQuery: { ...query, page, pageSize, sort },
      }
      return HttpResponse.json(body)
    }),
  ),

  http.get(
    `${API}/nfts/featured`,
    withNetwork(() => {
      const byPopularity = [...db.state.nfts].sort((a, b) => b.popularity - a.popularity)
      const hero = ['emerald-ape-042', 'velvet-monarch-077', 'sage-nomad-009']
        .map((id) => findNft(id))
        .filter((n): n is NftDetail => !!n)
        .map(toSummary)
      const spotlight = toSummary(findNft('cosmic-bloom-118') ?? byPopularity[0]!)
      return HttpResponse.json({ hero, spotlight })
    }),
  ),

  http.get(
    `${API}/nfts/:id`,
    withNetwork(({ params }) => {
      const nft = findNft(String(params.id))
      if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
      return HttpResponse.json(nft)
    }),
  ),

  http.get(
    `${API}/nfts/:id/related`,
    withNetwork(({ params }) => {
      const nft = findNft(String(params.id))
      if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
      const related = db.state.nfts
        .filter((n) => n.id !== nft.id && n.collection.id === nft.collection.id)
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 10)
        .map(toSummary)
      return HttpResponse.json({ items: related })
    }),
  ),
]
