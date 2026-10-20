/**
 * API de controle dos mocks: usada pelo painel de cenários e pelos testes Playwright
 * (via `page.evaluate(() => window.__kurioMock...)`).
 * Mutações passam pelo banco do mock → REST e Socket.IO refletem a mesma mudança.
 */
import Big from 'big.js'
import type { NftUpdatedEvent, RealtimeEvent } from '@/api/contracts'
import { bus, db, expireAllSessions, findNft, settleDueOrders, toSummary, updateNftEdition } from './db'
import { realtimeControl } from './realtime'
import { scenarios } from './scenarios'

export const mockControl = {
  scenarios: () => scenarios.map(({ id, label, description }) => ({ id, label, description })),
  getScenario: () => db.scenario.id,
  setScenario: (id: string) => db.setScenario(id).id,
  /** Restaura o estado conhecido (dados + cenário) */
  reset: (scenarioId?: string) => {
    db.reset(scenarioId)
    return db.scenario.id
  },

  /** Altera preço/disponibilidade como faria o backend (emite nft.updated). */
  updateNft(nftId: string, patch: { editionId?: string; price?: string; available?: number; priceDelta?: string }) {
    const nft = findNft(nftId)
    if (!nft) throw new Error(`NFT ${nftId} não existe`)
    const editionId = patch.editionId ?? nft.defaultEditionId
    const edition = nft.editions.find((e) => e.id === editionId)!
    const price = patch.priceDelta ? new Big(edition.price).plus(patch.priceDelta).toFixed(2) : patch.price
    return updateNftEdition(nftId, editionId, { price, available: patch.available })
  },

  /** Reenvia o último evento (duplicata exata — mesmo eventId). */
  replayLastEvent() {
    const last = bus.lastEvent
    if (last) bus.publish(last)
    return last
  },

  /** Emite um nft.updated ANTIGO (versão menor que a atual) com preço diferente. */
  emitStaleNftEvent(nftId: string, price = '0.01') {
    const nft = findNft(nftId)
    if (!nft) throw new Error(`NFT ${nftId} não existe`)
    const summary = toSummary(nft)
    const event: NftUpdatedEvent = {
      type: 'nft.updated',
      eventId: db.nextId('evt'),
      occurredAt: new Date(Date.now() - 60_000).toISOString(),
      version: Math.max(0, nft.version - 1),
      resource: { type: 'nft', id: nft.id },
      data: {
        price,
        available: summary.available,
        editions: nft.editions.map((e) => ({ id: e.id, price: e.id === nft.defaultEditionId ? price : e.price, available: e.available })),
      },
    }
    bus.publish(event)
    return event
  },

  emitRaw(event: RealtimeEvent) {
    bus.publish(event)
  },

  /** Simula queda do Socket.IO; reconexões são recusadas por `blockMs`. */
  disconnectRealtime(blockMs = 0) {
    realtimeControl.disconnectAll(blockMs)
  },
  restoreRealtime() {
    realtimeControl.unblock()
  },
  realtimeConnections: () => realtimeControl.connectedUsers,

  expireSessions() {
    expireAllSessions()
  },
  settleOrders() {
    settleDueOrders()
  },
  orders: () => Object.values(db.state.orders).map((o) => ({ id: o.id, status: o.status, userId: o.userId, idempotencyKey: o.idempotencyKey })),
  nft: (id: string) => findNft(id),
}

export type MockControl = typeof mockControl

declare global {
  interface Window {
    __kurioMock?: MockControl
  }
}
