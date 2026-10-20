import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { NftListQuery } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { eventGate } from '@/realtime/event-gate'

/** Toda resposta REST alimenta o registro de versões (eventos antigos não regridem o estado). */
const observe = <T extends { id: string; version: number }>(items: T[]) => {
  items.forEach((i) => eventGate.observe('nft', i.id, i.version))
}

export const nftListQuery = (q: NftListQuery) =>
  queryOptions({
    queryKey: qk.nfts.list(q),
    // o signal cancela a requisição quando os parâmetros mudam (respostas fora de ordem são descartadas)
    queryFn: async ({ signal }) => {
      const data = await api.nfts.list(q, { signal })
      observe(data.items)
      return data
    },
    placeholderData: keepPreviousData,
  })

export const nftDetailQuery = (id: string) =>
  queryOptions({
    queryKey: qk.nfts.detail(id),
    queryFn: async ({ signal }) => {
      const data = await api.nfts.detail(id, { signal })
      observe([data])
      return data
    },
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  })

export const featuredQuery = queryOptions({
  queryKey: qk.nfts.featured,
  queryFn: async ({ signal }) => {
    const data = await api.nfts.featured({ signal })
    observe([...data.hero, data.spotlight])
    return data
  },
  staleTime: 60_000,
})

export const relatedQuery = (id: string) =>
  queryOptions({
    queryKey: qk.nfts.related(id),
    queryFn: async ({ signal }) => {
      const data = await api.nfts.related(id, { signal })
      observe(data.items)
      return data
    },
  })

export const useNftList = (q: NftListQuery) => useQuery(nftListQuery(q))
export const useNftDetail = (id: string) => useQuery(nftDetailQuery(id))
export const useFeatured = () => useQuery(featuredQuery)
export const useRelated = (id: string) => useQuery(relatedQuery(id))
