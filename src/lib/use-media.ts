import { useCallback, useSyncExternalStore } from 'react'

/** Breakpoints do Tailwind: md = 48rem (768px), lg = 64rem (1024px). */
const DESKTOP_QUERY = '(min-width: 48rem)'
const WIDE_QUERY = '(min-width: 64rem)'

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', callback)
      return () => mql.removeEventListener('change', callback)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  )
}

/**
 * Renderiza só o layout do breakpoint atual (em vez de montar mobile + desktop e esconder um
 * por CSS): menos componentes, JS, DOM e layout — impacto direto no TBT/FCP no mobile.
 */
export const useIsDesktop = () => useMediaQuery(DESKTOP_QUERY)

/** A partir de `lg` (sidebar de filtros do catálogo). */
export const useIsWide = () => useMediaQuery(WIDE_QUERY)
