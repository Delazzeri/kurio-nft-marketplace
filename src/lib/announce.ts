/**
 * Anúncios acessíveis (aria-live) para mutations e alterações em tempo real.
 * Um único <LiveRegion/> no root consome esta fila.
 */
type Politeness = 'polite' | 'assertive'
type Listener = (message: string, politeness: Politeness) => void

const listeners = new Set<Listener>()

export function announce(message: string, politeness: Politeness = 'polite') {
  listeners.forEach((l) => l(message, politeness))
}

export function onAnnounce(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
