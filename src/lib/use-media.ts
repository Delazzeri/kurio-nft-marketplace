import { useSyncExternalStore } from 'react'

/** Mesmo breakpoint `md` do Tailwind (48rem = 768px). */
const DESKTOP_QUERY = '(min-width: 48rem)'

function subscribe(callback: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

/**
 * Renderiza só o layout do breakpoint atual (em vez de montar mobile + desktop e esconder um
 * por CSS): menos componentes, DOM e layout — impacto direto no TBT/FCP no mobile.
 */
export function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  )
}
