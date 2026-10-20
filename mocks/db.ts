/**
 * Banco em memória do mock, persistido em localStorage para sobreviver a refresh.
 * Toda mudança relevante publica eventos no barramento — o handler Socket.IO os repassa.
 */
import Big from 'big.js'
import type {
  Cart,
  CartItem,
  NetworkId,
  NftDetail,
  NftSummary,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
  Quote,
  RealtimeEvent,
  Wallet,
} from '@/api/contracts'
import { DEFAULT_SCENARIO, createRng, getScenarioById, type Scenario } from './scenarios'
import { MAX_QTY_PER_ITEM, buildSeedNfts, coupons, networkFees, seedUsers, type SeedUser } from './seed'

// v2: catálogo não é mais persistido inteiro — só os patches (preço/estoque/versão)
const STORAGE_KEY = 'kurio:mock:db:v2'
const SCENARIO_KEY = 'kurio:mock:scenario'
const DEFAULT_PAYMENT_DELAY = 3000
const SESSION_TTL = 2 * 60 * 60 * 1000
const QUOTE_TTL = 10 * 60 * 1000

export interface StoredCart {
  id: string
  userId: string | null
  items: { id: string; nftId: string; editionId: string; quantity: number; acknowledgedPrice: string }[]
  couponCode: string | null
  version: number
  updatedAt: string
}

export interface StoredOrder extends Order {
  userId: string
  requestHash: string
  cartId: string
  settleAt: number
  walletType: string
}

export interface StoredSession {
  token: string
  userId: string
  expiresAt: number
  revoked: boolean
}

export interface WalletSessionRecord {
  id: string
  userId: string
  walletId: string
  network: NetworkId
  provider: string
  address: string
  connectedAt: string
}

interface State {
  users: SeedUser[]
  sessions: Record<string, StoredSession>
  /** catálogo em memória (seed + patches); não é persistido */
  nfts: NftDetail[]
  /** alterações do catálogo desde o seed — é isso que vai para o localStorage */
  nftPatches: Record<string, { version: number; editions: { id: string; price: string; available: number }[] }>
  favorites: Record<string, string[]>
  carts: Record<string, StoredCart>
  userCarts: Record<string, string>
  quotes: Record<string, Quote & { cartId: string }>
  orders: Record<string, StoredOrder>
  idempotency: Record<string, string>
  wallets: Record<string, { primary: Wallet | null; secondary: Wallet | null }>
  walletSessions: Record<string, WalletSessionRecord>
  /** marca efeitos de cenário de disparo único (ex.: preço alterado já aplicado) */
  scenarioOnce: Record<string, boolean>
  seq: number
}

function seedState(): State {
  return {
    users: structuredClone(seedUsers),
    sessions: {},
    nfts: buildSeedNfts(),
    nftPatches: {},
    favorites: { usr_ana: ['sage-nomad-009'], usr_bruno: [] },
    carts: {},
    userCarts: {},
    quotes: {},
    orders: {},
    idempotency: {},
    wallets: {
      usr_ana: {
        primary: {
          id: 'wal_ana_primary',
          slot: 'primary',
          displayName: 'Ana Colecionadora',
          nickname: 'Cofre da Ana',
          network: 'ethereum',
          profileName: 'ana.coleciona',
          address: '0xA91F3c2B7d4E5f60718293a4B5c6D7e8F9012E8C',
          secondaryAddress: 'anacoleciona.eth',
          walletType: 'metamask',
          referralCode: 'KURIO2026',
          email: 'ana@kurio.dev',
          ensName: 'anacoleciona',
          sameAsPrimary: false,
          updatedAt: new Date(0).toISOString(),
        },
        secondary: null,
      },
      usr_bruno: { primary: null, secondary: null },
    },
    walletSessions: {},
    scenarioOnce: {},
    seq: 1,
  }
}

function applyPatches(nfts: NftDetail[], patches: State['nftPatches']) {
  for (const nft of nfts) {
    const patch = patches[nft.id]
    if (!patch) continue
    nft.version = patch.version
    for (const e of patch.editions) {
      const edition = nft.editions.find((x) => x.id === e.id)
      if (edition) Object.assign(edition, { price: e.price, available: e.available })
    }
    const summary = toSummary(nft)
    nft.price = summary.price
    nft.available = summary.available
  }
  return nfts
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Omit<State, 'nfts'>
      return { ...stored, nfts: applyPatches(buildSeedNfts(), stored.nftPatches ?? {}) }
    }
  } catch {
    /* estado corrompido → seed */
  }
  return seedState()
}

let state: State = load()
let scenario: Scenario = getScenarioById(readScenarioId())
let rng = createRng(1337)
/** Contadores para regras de falha com `times` */
const failureHits = new Map<string, number>()

function readScenarioId() {
  try {
    const fromUrl = new URLSearchParams(location.search).get('cenario')
    if (fromUrl) {
      localStorage.setItem(SCENARIO_KEY, fromUrl)
      return fromUrl
    }
    return localStorage.getItem(SCENARIO_KEY) ?? DEFAULT_SCENARIO
  } catch {
    return DEFAULT_SCENARIO
  }
}

export function persist() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { nfts, ...persisted } = state
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
  } catch {
    /* cota */
  }
}

export const db = {
  get state() {
    return state
  },
  get scenario() {
    return scenario
  },
  setScenario(id: string) {
    scenario = getScenarioById(id)
    rng = createRng(1337)
    failureHits.clear()
    state.scenarioOnce = {}
    try {
      localStorage.setItem(SCENARIO_KEY, scenario.id)
    } catch {
      /* noop */
    }
    persist()
    return scenario
  },
  /** Restaura integralmente o cenário conhecido (dados + cenário padrão). */
  reset(scenarioId: string = DEFAULT_SCENARIO) {
    state = seedState()
    persist()
    db.setScenario(scenarioId)
  },
  latency(): number {
    const [min, max] = scenario.latency
    return Math.round(min + (max - min) * rng())
  },
  failureHit(ruleKey: string) {
    const n = (failureHits.get(ruleKey) ?? 0) + 1
    failureHits.set(ruleKey, n)
    return n
  },
  nextId(prefix: string) {
    state.seq += 1
    return `${prefix}_${state.seq.toString(36)}${Math.floor(rng() * 1e6).toString(36)}`
  },
}

/* ------------------------------------------------------------------ Event bus */

type Listener = (event: RealtimeEvent) => void
const listeners = new Set<Listener>()
let lastEvent: RealtimeEvent | null = null

export const bus = {
  subscribe(fn: Listener) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  publish(event: RealtimeEvent) {
    lastEvent = event
    listeners.forEach((fn) => fn(event))
  },
  get lastEvent() {
    return lastEvent
  },
}

/* ------------------------------------------------------------------ NFTs */

export function toSummary(nft: NftDetail): NftSummary {
  const def = nft.editions.find((e) => e.id === nft.defaultEditionId) ?? nft.editions[0]!
  return {
    id: nft.id,
    name: nft.name,
    tokenId: nft.tokenId,
    image: nft.image,
    imageAlt: nft.imageAlt,
    collection: nft.collection,
    category: nft.category,
    network: nft.network,
    networks: nft.networks,
    price: def.price,
    compareAtPrice: def.compareAtPrice,
    available: nft.editions.reduce((acc, e) => acc + e.available, 0),
    badge: nft.badge,
    listedAt: nft.listedAt,
    popularity: nft.popularity,
    version: nft.version,
  }
}

export function findNft(id: string) {
  return state.nfts.find((n) => n.id === id)
}

/** Atualiza preço/disponibilidade de uma edição e emite `nft.updated` com nova versão. */
export function updateNftEdition(
  nftId: string,
  editionId: string,
  patch: { price?: string; available?: number },
): NftUpdatedEvent | null {
  const nft = findNft(nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  if (!nft || !edition) return null
  const previousSummary = toSummary(nft)
  if (patch.price !== undefined) edition.price = new Big(patch.price).toFixed(2)
  if (patch.available !== undefined) edition.available = Math.max(0, patch.available)
  nft.version += 1
  const summary = toSummary(nft)
  nft.price = summary.price
  nft.available = summary.available
  state.nftPatches[nft.id] = { version: nft.version, editions: nft.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })) }
  persist()
  const event: NftUpdatedEvent = {
    type: 'nft.updated',
    eventId: db.nextId('evt'),
    occurredAt: new Date().toISOString(),
    version: nft.version,
    resource: { type: 'nft', id: nft.id },
    data: {
      price: summary.price,
      available: summary.available,
      editions: nft.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })),
      previousPrice: previousSummary.price !== summary.price ? previousSummary.price : undefined,
    },
  }
  bus.publish(event)
  return event
}

/* ------------------------------------------------------------------ Carrinho */

export function getOrCreateCart(id: string, userId: string | null): StoredCart {
  let cart = state.carts[id]
  if (!cart) {
    cart = { id, userId, items: [], couponCode: null, version: 1, updatedAt: new Date().toISOString() }
    state.carts[id] = cart
    persist()
  }
  return cart
}

export function userCart(userId: string): StoredCart {
  let id = state.userCarts[userId]
  if (!id) {
    id = `cart_${userId}`
    state.userCarts[userId] = id
  }
  return getOrCreateCart(id, userId)
}

export function touchCart(cart: StoredCart) {
  cart.version += 1
  cart.updatedAt = new Date().toISOString()
  persist()
}

export function maxQuantity(available: number) {
  return Math.min(available, MAX_QTY_PER_ITEM)
}

export function cartView(cart: StoredCart): Cart {
  const items: CartItem[] = []
  for (const item of cart.items) {
    const nft = findNft(item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId)
    if (!nft || !edition) continue
    const issues: CartItem['issues'] = []
    if (edition.available === 0) issues.push('SOLD_OUT')
    else if (item.quantity > edition.available) issues.push('INSUFFICIENT_AVAILABILITY')
    if (new Big(edition.price).cmp(item.acknowledgedPrice) !== 0) issues.push('PRICE_CHANGED')
    items.push({
      id: item.id,
      nftId: nft.id,
      editionId: edition.id,
      editionLabel: edition.label,
      name: nft.name,
      tokenId: nft.tokenId,
      image: nft.image,
      imageAlt: nft.imageAlt,
      quantity: item.quantity,
      unitPrice: edition.price,
      lineTotal: new Big(edition.price).times(item.quantity).toString(),
      acknowledgedPrice: item.acknowledgedPrice,
      available: edition.available,
      issues,
    })
  }
  const coupon = cart.couponCode && coupons[cart.couponCode]
  return {
    id: cart.id,
    owner: cart.userId ? 'user' : 'guest',
    items,
    itemCount: items.reduce((acc, i) => acc + i.quantity, 0),
    coupon: coupon ? { code: cart.couponCode!, description: coupon.description } : null,
    version: cart.version,
    updatedAt: cart.updatedAt,
  }
}

export function mergeCarts(from: StoredCart, into: StoredCart) {
  for (const item of from.items) {
    const nft = findNft(item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId)
    if (!edition) continue
    const existing = into.items.find((i) => i.nftId === item.nftId && i.editionId === item.editionId)
    if (existing) {
      existing.quantity = Math.max(1, Math.min(existing.quantity + item.quantity, maxQuantity(edition.available) || existing.quantity))
    } else {
      into.items.push({ ...item, id: db.nextId('ci') })
    }
  }
  if (!into.couponCode && from.couponCode) into.couponCode = from.couponCode
  delete state.carts[from.id]
  touchCart(into)
}

/* ------------------------------------------------------------------ Cotação */

export function buildQuote(cart: StoredCart, network: NetworkId): Quote & { cartId: string } {
  const view = cartView(cart)
  const items: Quote['items'] = view.items.map((i) => ({
    cartItemId: i.id,
    nftId: i.nftId,
    editionId: i.editionId,
    editionLabel: i.editionLabel,
    name: i.name,
    tokenId: i.tokenId,
    image: i.image,
    imageAlt: i.imageAlt,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: i.lineTotal,
    nftVersion: findNft(i.nftId)?.version ?? 0,
  }))
  const subtotal = items.reduce((acc, i) => acc.plus(i.lineTotal), new Big(0))
  let discount = new Big(0)
  const coupon = cart.couponCode ? coupons[cart.couponCode] : undefined
  if (coupon && !coupon.expired && items.length > 0) {
    discount = coupon.kind === 'percent' ? subtotal.times(coupon.value).round(6, Big.roundDown) : new Big(coupon.value)
    if (discount.gt(subtotal)) discount = subtotal
  }
  const networkFee = items.length > 0 ? new Big(networkFees[network]) : new Big(0)
  const total = subtotal.minus(discount).plus(networkFee)
  const blockingIssues: Quote['blockingIssues'] = []
  for (const i of view.items) {
    if (i.issues.includes('SOLD_OUT')) blockingIssues.push({ cartItemId: i.id, code: 'SOLD_OUT', message: `${i.name} (${i.editionLabel}) esgotou.` })
    else if (i.issues.includes('INSUFFICIENT_AVAILABILITY'))
      blockingIssues.push({ cartItemId: i.id, code: 'INSUFFICIENT_AVAILABILITY', message: `Restam apenas ${i.available} unidade(s) de ${i.name} (${i.editionLabel}).` })
  }
  const now = Date.now()
  const quote = {
    id: db.nextId('qt'),
    cartId: cart.id,
    cartVersion: cart.version,
    network,
    items,
    coupon: view.coupon,
    subtotal: subtotal.toString(),
    discount: discount.toString(),
    networkFee: networkFee.toString(),
    total: total.toString(),
    blockingIssues,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + QUOTE_TTL).toISOString(),
  }
  state.quotes[quote.id] = quote
  persist()
  return quote
}

/** A cotação ainda reflete exatamente o carrinho e o catálogo atuais? */
export function isQuoteCurrent(quote: Quote & { cartId: string }) {
  const cart = state.carts[quote.cartId]
  if (!cart || cart.version !== quote.cartVersion) return false
  if (Date.parse(quote.expiresAt) < Date.now()) return false
  if (quote.blockingIssues.length > 0) return false
  return quote.items.every((i) => {
    const nft = findNft(i.nftId)
    const edition = nft?.editions.find((e) => e.id === i.editionId)
    return !!edition && nft!.version === i.nftVersion && new Big(edition.price).eq(i.unitPrice) && edition.available >= i.quantity
  })
}

/* ------------------------------------------------------------------ Pedidos */

export function paymentDelay() {
  return scenario.flags?.paymentDelayMs ?? DEFAULT_PAYMENT_DELAY
}

/** Liquida pedidos pendentes cujo prazo venceu (resistente a refresh: usa timestamps, não timers). */
export function settleDueOrders(now = Date.now()) {
  for (const order of Object.values(state.orders)) {
    if (order.status !== 'pending' || order.settleAt > now) continue
    settleOrder(order)
  }
}

function settleOrder(order: StoredOrder) {
  let declineReason: string | null = null
  if (scenario.flags?.paymentDeclined) declineReason = 'Pagamento recusado pela carteira.'
  const touched: { nftId: string; editionId: string; available: number }[] = []
  if (!declineReason) {
    for (const item of order.receipt.items) {
      const edition = findNft(item.nftId)?.editions.find((e) => e.id === item.editionId)
      if (!edition || edition.available < item.quantity) {
        declineReason = `A edição ${item.editionLabel} de ${item.name} esgotou antes da confirmação.`
        break
      }
    }
  }
  const now = new Date().toISOString()
  order.version += 1
  order.updatedAt = now
  if (declineReason) {
    order.status = 'declined'
    order.declineReason = declineReason
  } else {
    order.status = 'confirmed'
    const hash = `0x${Array.from({ length: 64 }, (_, i) => '0123456789abcdef'[(order.id.charCodeAt(i % order.id.length) + i * 7) % 16]).join('')}`
    order.transaction = {
      hash,
      explorerUrl: `https://sepolia.etherscan.io/tx/${hash}`,
      confirmedAt: now,
    }
    for (const item of order.receipt.items) {
      const edition = findNft(item.nftId)!.editions.find((e) => e.id === item.editionId)!
      touched.push({ nftId: item.nftId, editionId: item.editionId, available: edition.available - item.quantity })
    }
    // remove do carrinho somente os itens/quantidades comprados
    const cart = state.carts[order.cartId]
    if (cart) {
      for (const bought of order.receipt.items) {
        const ci = cart.items.find((i) => i.nftId === bought.nftId && i.editionId === bought.editionId)
        if (!ci) continue
        ci.quantity -= bought.quantity
      }
      cart.items = cart.items.filter((i) => i.quantity > 0)
      cart.couponCode = null
      touchCart(cart)
    }
  }
  persist()
  const event: OrderUpdatedEvent = {
    type: 'order.updated',
    eventId: db.nextId('evt'),
    occurredAt: now,
    version: order.version,
    resource: { type: 'order', id: order.id },
    userId: order.userId,
    data: { status: order.status, declineReason: order.declineReason },
  }
  bus.publish(event)
  for (const t of touched) updateNftEdition(t.nftId, t.editionId, { available: t.available })
}

export function publicOrder(order: StoredOrder): Order {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId, requestHash, cartId, settleAt, walletType, ...rest } = order
  return rest
}

/* ------------------------------------------------------------------ Sessões */

export function createSession(userId: string) {
  const token = `tok_${crypto.randomUUID()}`
  const ttl = scenario.flags?.shortSession ? 45_000 : SESSION_TTL
  const session: StoredSession = { token, userId, expiresAt: Date.now() + ttl, revoked: false }
  state.sessions[token] = session
  persist()
  return session
}

export function expireAllSessions() {
  for (const s of Object.values(state.sessions)) s.expiresAt = Math.min(s.expiresAt, Date.now() - 1)
  persist()
}

export async function hashPassword(salt: string, password: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/* Liquidação periódica (respeita page.clock nos testes, pois usa Date.now) */
if (typeof window !== 'undefined') {
  settleDueOrders()
  window.setInterval(() => settleDueOrders(), 250)
}
