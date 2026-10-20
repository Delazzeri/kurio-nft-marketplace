import { z } from 'zod'
import { catalogTabIds, categoryIds, networkIds, sortIds, type NftListQuery } from '@/api/contracts'

const arrayOf = <T extends string>(values: readonly [T, ...T[]]) =>
  z
    .union([z.array(z.string()), z.string()])
    .transform((v) => (Array.isArray(v) ? v : [v]).filter((x): x is T => (values as readonly string[]).includes(x)))
    .transform((v) => (v.length ? [...new Set(v)].sort() : undefined))
    .optional()
    .catch(undefined)

const ethParam = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .pipe(z.string().regex(/^\d+(\.\d+)?$/))
  .optional()
  .catch(undefined)

/**
 * Estado do catálogo na URL — sobrevive a refresh, compartilhamento e histórico.
 * Parâmetros inválidos são descartados em vez de quebrar a página.
 */
export const catalogSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || undefined)
    .optional()
    .catch(undefined),
  cat: arrayOf(categoryIds),
  net: arrayOf(networkIds),
  min: ethParam,
  max: ethParam,
  tab: z.enum(catalogTabIds).optional().catch(undefined),
  sort: z.enum(sortIds).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
})

export type CatalogSearch = z.infer<typeof catalogSearchSchema>

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
