/**
 * Porta de entrada dos eventos: descarta duplicatas (eventId) e eventos antigos (versão).
 * As versões conhecidas também são alimentadas pelas respostas REST, para que um evento
 * atrasado nunca regrida um estado mais novo obtido por consulta.
 */
const MAX_SEEN = 1000

const seen = new Set<string>()
const versions = new Map<string, number>()

const key = (type: string, id: string) => `${type}:${id}`

export const eventGate = {
  /** Registra a versão vista via REST ou evento (mantém a maior). */
  observe(type: string, id: string, version: number) {
    const k = key(type, id)
    if ((versions.get(k) ?? -1) < version) versions.set(k, version)
  },
  known(type: string, id: string) {
    return versions.get(key(type, id)) ?? -1
  },
  /** true se o evento deve ser aplicado; registra id e versão. */
  admit(event: { eventId: string; version: number; resource: { type: string; id: string } }): {
    accepted: boolean
    reason?: 'duplicate' | 'stale'
  } {
    if (seen.has(event.eventId)) return { accepted: false, reason: 'duplicate' }
    seen.add(event.eventId)
    if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value!)
    const k = key(event.resource.type, event.resource.id)
    if ((versions.get(k) ?? -1) >= event.version) return { accepted: false, reason: 'stale' }
    versions.set(k, event.version)
    return { accepted: true }
  },
  reset() {
    seen.clear()
    versions.clear()
  },
}
