/**
 * Fixtures determinísticas. `reset()` sempre restaura exatamente este estado.
 */
import Big from 'big.js'
import type { CategoryId, Edition, NetworkId, NftDetail } from '@/api/contracts'
import { createRng } from './scenarios'

export const SEED_NOW = Date.parse('2026-10-01T12:00:00.000Z')
/** Listagens a partir desta data aparecem em "Novos lançamentos" */
export const NEW_RELEASE_CUTOFF = Date.parse('2026-09-15T00:00:00.000Z')
/** Popularidade mínima para "Em alta" */
export const TRENDING_THRESHOLD = 70

export interface SeedUser {
  id: string
  email: string
  username: string
  displayName: string
  ensName: string
  walletNickname: string
  avatarUrl: string | null
  salt: string
  /** sha256(salt + ':' + senha) — senhas nunca ficam em claro */
  passwordHash: string
  updatedAt: string
}

export const seedUsers: SeedUser[] = [
  {
    id: 'usr_ana',
    email: 'ana@kurio.dev',
    username: 'ana.coleciona',
    displayName: 'Ana Colecionadora',
    ensName: 'anacoleciona',
    walletNickname: 'Cofre da Ana',
    avatarUrl: null,
    salt: 's4lt-ana',
    passwordHash: 'c3be53475363a80642d9ce621228ed3613b7e4812e5b7f6e9b16e8fbfb1d6af7',
    updatedAt: new Date(SEED_NOW).toISOString(),
  },
  {
    id: 'usr_bruno',
    email: 'bruno@kurio.dev',
    username: 'bruno.nft',
    displayName: 'Bruno Cripto',
    ensName: 'brunonft',
    walletNickname: 'Carteira do Bruno',
    avatarUrl: null,
    salt: 's4lt-bruno',
    passwordHash: 'd9f17f4f8981be222854e79ed72424a9e163a105bf5b8c4b7a06406629c13d00',
    updatedAt: new Date(SEED_NOW).toISOString(),
  },
]

type Family = 'emerald' | 'sage' | 'baron' | 'golden'

const familyInfo: Record<Family, { alt: string; attributes: string[] }> = {
  emerald: {
    alt: 'Macaco de pelagem marrom com óculos redondos verdes e jaqueta college verde',
    attributes: ['Óculos', 'Esmeralda', 'Raro'],
  },
  sage: {
    alt: 'Gorila cinza com chapéu bucket verde-sálvia e moletom roxo',
    attributes: ['Chapéu bucket', 'Moletom', 'Comum'],
  },
  baron: {
    alt: 'Macaco de pelagem preta com gola alta verde e blazer marfim',
    attributes: ['Blazer', 'Gola alta', 'Épico'],
  },
  golden: {
    alt: 'Macaco dourado com fones de ouvido verdes e jaqueta creme',
    attributes: ['Fones', 'Dourado', 'Lendário'],
  },
}

interface NftSeedRow {
  name: string
  family: Family
  category: CategoryId
  network: NetworkId
  price: string
  compareAtPrice?: string
  daysAgo: number
  popularity: number
  badge?: string
  collection?: string
  /** disponibilidade por edição: [1/1, 1/10, 1/50, aberta] */
  stock?: [number, number, number, number]
  /** redes adicionais (NFT multichain) */
  extraNetworks?: NetworkId[]
}

/* 36 NFTs = 4 páginas de 9 no catálogo, distribuídos entre categorias e redes */
const rows: NftSeedRow[] = [
  { name: 'Emerald Ape #042', family: 'emerald', category: 'arte-digital', network: 'ethereum', price: '1.19', daysAgo: 1, popularity: 98, badge: 'RARO', stock: [0, 3, 12, 500] },
  { name: 'Sage Nomad #009', family: 'sage', category: 'arte-digital', network: 'ethereum', price: '1.69', daysAgo: 2, popularity: 91 },
  { name: 'Neon Vessel #552', family: 'baron', category: 'colecionaveis', network: 'ethereum', price: '1.99', compareAtPrice: '2.29', daysAgo: 3, popularity: 88 },
  { name: 'Cosmic Bloom #118', family: 'sage', category: 'generativa', network: 'polygon', price: '1.29', daysAgo: 4, popularity: 76 },
  { name: 'Violet Nomad #314', family: 'sage', category: 'arte-digital', network: 'ethereum', price: '1.39', daysAgo: 5, popularity: 83, stock: [1, 4, 20, 500] },
  { name: 'Ivory Baron #088', family: 'baron', category: 'arte-3d', network: 'ethereum', price: '1.79', daysAgo: 6, popularity: 79, stock: [1, 5, 15, 500] },
  { name: 'Golden Beat #207', family: 'golden', category: 'musica', network: 'solana', price: '0.99', daysAgo: 7, popularity: 72 },
  { name: 'Golden Frequency #071', family: 'golden', category: 'musica', network: 'polygon', price: '0.59', daysAgo: 8, popularity: 64 },
  { name: 'Golden Signal #160', family: 'golden', category: 'musica', network: 'ethereum', price: '0.39', daysAgo: 9, popularity: 58 },
  { name: 'Amber Pulse #233', family: 'golden', category: 'fotografia', network: 'ethereum', price: '0.72', daysAgo: 10, popularity: 55 },
  { name: 'Obsidian Duke #019', family: 'baron', category: 'colecionaveis', network: 'solana', price: '2.45', daysAgo: 11, popularity: 81 },
  { name: 'Jade Captain #301', family: 'emerald', category: 'jogos', network: 'polygon', price: '0.88', daysAgo: 12, popularity: 67 },
  { name: 'Lilac Wanderer #144', family: 'sage', category: 'fotografia', network: 'polygon', price: '0.45', daysAgo: 13, popularity: 49 },
  { name: 'Velvet Monarch #077', family: 'baron', category: 'arte-digital', network: 'ethereum', price: '3.10', daysAgo: 14, popularity: 93 },
  { name: 'Citrus Groove #412', family: 'golden', category: 'musica', network: 'solana', price: '0.27', daysAgo: 15, popularity: 41 },
  { name: 'Forest Shades #058', family: 'emerald', category: 'arte-3d', network: 'ethereum', price: '1.55', daysAgo: 16, popularity: 74 },
  { name: 'Misty Ranger #266', family: 'sage', category: 'utilidade', network: 'polygon', price: '0.33', daysAgo: 18, popularity: 38 },
  { name: 'Marble Count #190', family: 'baron', category: 'assinaturas', network: 'ethereum', price: '0.95', daysAgo: 20, popularity: 52 },
  { name: 'Sunlit Echo #349', family: 'golden', category: 'generativa', network: 'ethereum', price: '1.12', daysAgo: 22, popularity: 69 },
  { name: 'Mint Aviator #023', family: 'emerald', category: 'colecionaveis', network: 'solana', price: '2.05', compareAtPrice: '2.40', daysAgo: 24, popularity: 86 },
  { name: 'Plum Drifter #275', family: 'sage', category: 'jogos', network: 'solana', price: '0.64', daysAgo: 26, popularity: 47 },
  { name: 'Onyx Regent #101', family: 'baron', category: 'fotografia', network: 'polygon', price: '1.42', daysAgo: 28, popularity: 63 },
  { name: 'Honey Tempo #388', family: 'golden', category: 'assinaturas', network: 'polygon', price: '0.18', daysAgo: 30, popularity: 35 },
  { name: 'Verdant Jet #066', family: 'emerald', category: 'utilidade', network: 'ethereum', price: '0.79', daysAgo: 32, popularity: 57 },
  { name: 'Heather Scout #157', family: 'sage', category: 'arte-3d', network: 'ethereum', price: '1.05', daysAgo: 34, popularity: 61 },
  { name: 'Ebony Envoy #212', family: 'baron', category: 'jogos', network: 'ethereum', price: '1.88', daysAgo: 36, popularity: 77 },
  { name: 'Brass Rhythm #430', family: 'golden', category: 'colecionaveis', network: 'ethereum', price: '0.52', daysAgo: 38, popularity: 44 },
  { name: 'Emerald Pilot #011', family: 'emerald', category: 'generativa', network: 'polygon', price: '12.30', daysAgo: 40, popularity: 99 },
  { name: 'Dusk Pilgrim #298', family: 'sage', category: 'assinaturas', network: 'solana', price: '0.02', daysAgo: 42, popularity: 22 },
  { name: 'Ivory Consul #134', family: 'baron', category: 'utilidade', network: 'solana', price: '0.68', daysAgo: 44, popularity: 39 },
  { name: 'Golden Static #455', family: 'golden', category: 'jogos', network: 'polygon', price: '0.41', daysAgo: 46, popularity: 33 },
  { name: 'Clover Ace #037', family: 'emerald', category: 'fotografia', network: 'solana', price: '0.97', daysAgo: 48, popularity: 54 },
  { name: 'Lavender Sage #321', family: 'sage', category: 'colecionaveis', network: 'polygon', price: '1.21', daysAgo: 50, popularity: 66 },
  { name: 'Coal Marquis #176', family: 'baron', category: 'generativa', network: 'ethereum', price: '2.75', daysAgo: 52, popularity: 84 },
  { name: 'Saffron Loop #467', family: 'golden', category: 'utilidade', network: 'ethereum', price: '0.25', daysAgo: 54, popularity: 29 },
  /* esgotado em todas as edições — exercita "edição indisponível" */
  { name: 'Phantom Ape #000', family: 'emerald', category: 'arte-digital', network: 'ethereum', price: '4.20', daysAgo: 56, popularity: 71, stock: [0, 0, 0, 0] },
]

const multipliers = { '1-1': '3', '1-10': '1.5', '1-50': '1', aberta: '0.6' } as const

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/#/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function round2(v: Big) {
  return v.round(2, Big.roundHalfUp).toFixed(2)
}

function buildEditions(row: NftSeedRow): Edition[] {
  const [s11 = 1, s110 = 6, s150 = 25, sOpen = 500] = row.stock ?? [1, 6, 25, 500]
  const base = new Big(row.price)
  return [
    { id: '1-1', label: '1/1', price: round2(base.times(multipliers['1-1'])), available: s11, supply: 1 },
    { id: '1-10', label: '1/10', price: round2(base.times(multipliers['1-10'])), available: s110, supply: 10 },
    {
      id: '1-50',
      label: '1/50',
      price: round2(base),
      compareAtPrice: row.compareAtPrice,
      available: s150,
      supply: 50,
    },
    { id: 'aberta', label: 'ABERTA', price: round2(base.times(multipliers.aberta)), available: sOpen, supply: null },
  ]
}

export function buildSeedNfts(): NftDetail[] {
  return [...rows, ...generateRows()].map((row, index) => {
    const id = slugify(row.name)
    const tokenNumber = row.name.split('#')[1] ?? String(index)
    const info = familyInfo[row.family]
    const editions = buildEditions(row)
    const image = `/nfts/${row.family}.webp`
    const collectionName = row.collection ?? 'Kurio Apes'
    const nameOnly = row.name.split(' #')[0]
    return {
      id,
      name: row.name,
      tokenId: `#${tokenNumber.padStart(4, '0')}`,
      image,
      imageAlt: `${row.name}: ${info.alt}`,
      collection: { id: 'kurio-apes', name: collectionName },
      category: row.category,
      network: row.network,
      networks: [row.network, ...(row.extraNetworks ?? [])],
      price: row.price,
      compareAtPrice: row.compareAtPrice,
      available: editions.reduce((acc, e) => acc + e.available, 0),
      badge: row.badge,
      listedAt: new Date(SEED_NOW - row.daysAgo * 86_400_000).toISOString(),
      popularity: row.popularity,
      version: 1,
      description: `Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na ${labelNetwork(row.network)}, com arte desbloqueável e acesso para colecionadores.`,
      story: [
        `${row.name} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na ${labelNetwork(row.network)}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
        `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. ${nameOnly} recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
      ],
      gallery: [0, 1, 2, 3].map((n) => ({
        src: image,
        alt: n === 0 ? `${row.name}, vista principal` : `${row.name}, detalhe ${n}`,
      })),
      attributes: info.attributes,
      rating: 4.8,
      reviewsCount: 19,
      contract: '0x7A42…19E8 · Contrato inteligente ERC-721 verificado.',
      royalties: 'Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.',
      editions,
      defaultEditionId: '1-50',
    }
  })
}

/* ------------------------------------------------------------------ Catálogo completo
 * O Figma mostra 239 NFTs por coleção (33+12+65+39+23+17+19+13+18) e 283 por rede (119+78+86).
 * Para fechar os dois números, 44 NFTs são multichain (listados em duas redes).
 * Os 36 itens acima são fixos; o restante é gerado de forma determinística (PRNG com seed fixa).
 */
export const CATEGORY_TARGETS: Record<CategoryId, number> = {
  'arte-digital': 33,
  fotografia: 12,
  musica: 65,
  'arte-3d': 39,
  colecionaveis: 23,
  generativa: 17,
  jogos: 19,
  assinaturas: 13,
  utilidade: 18,
}
/** Rede principal de cada NFT (soma 239) */
const PRIMARY_NETWORK_TARGETS: Record<NetworkId, number> = { ethereum: 99, polygon: 60, solana: 80 }
/** Listagens adicionais dos NFTs multichain (soma 44) → totais por rede 119 / 78 / 86 */
const SECONDARY_NETWORK_TARGETS: Record<NetworkId, number> = { ethereum: 20, polygon: 18, solana: 6 }

const adjectives = [
  'Amber', 'Azure', 'Brass', 'Cedar', 'Citrus', 'Clover', 'Coal', 'Cobalt', 'Copper', 'Coral', 'Crimson', 'Dune', 'Dusk', 'Ebony',
  'Ember', 'Fern', 'Forest', 'Frost', 'Ginger', 'Granite', 'Harbor', 'Hazel', 'Heather', 'Honey', 'Indigo', 'Iris', 'Jade', 'Juniper',
  'Lavender', 'Lilac', 'Linen', 'Lunar', 'Maple', 'Marble', 'Meadow', 'Mint', 'Misty', 'Moss', 'Neon', 'Nova', 'Obsidian', 'Ochre',
  'Olive', 'Onyx', 'Opal', 'Pearl', 'Pine', 'Plum', 'Quartz', 'Rose', 'Ruby', 'Russet', 'Saffron', 'Sand', 'Scarlet', 'Shadow',
  'Silver', 'Slate', 'Solar', 'Storm', 'Sunlit', 'Teal', 'Thistle', 'Topaz', 'Velvet', 'Verdant', 'Willow',
]
const familyNouns: Record<Family, string[]> = {
  emerald: ['Ape', 'Captain', 'Pilot', 'Aviator', 'Ace', 'Racer', 'Shades', 'Navigator'],
  sage: ['Nomad', 'Wanderer', 'Ranger', 'Drifter', 'Scout', 'Pilgrim', 'Hiker', 'Rover'],
  baron: ['Baron', 'Duke', 'Monarch', 'Count', 'Regent', 'Envoy', 'Consul', 'Marquis'],
  golden: ['Beat', 'Pulse', 'Groove', 'Echo', 'Tempo', 'Rhythm', 'Loop', 'Signal'],
}
const families: Family[] = ['emerald', 'sage', 'baron', 'golden']

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function slots<K extends string>(targets: Record<K, number>, existing: Partial<Record<K, number>>): K[] {
  return (Object.keys(targets) as K[]).flatMap((k) => Array.from({ length: targets[k] - (existing[k] ?? 0) }, () => k))
}

function generateRows(): NftSeedRow[] {
  const rand = createRng(2026)
  const count = <K extends string>(pick: (r: NftSeedRow) => K) =>
    rows.reduce<Partial<Record<K, number>>>((acc, r) => ({ ...acc, [pick(r)]: (acc[pick(r)] ?? 0) + 1 }), {})

  const categorySlots = shuffle(slots(CATEGORY_TARGETS, count((r) => r.category)), rand)
  const networkSlots = shuffle(slots(PRIMARY_NETWORK_TARGETS, count((r) => r.network)), rand)
  const usedNames = new Set(rows.map((r) => r.name.split(' #')[0]))
  const usedTokens = new Set(rows.map((r) => r.name.split('#')[1]))

  const generated = categorySlots.map((category, i): NftSeedRow => {
    const family = families[Math.floor(rand() * families.length)]!
    let base: string
    do {
      const adj = adjectives[Math.floor(rand() * adjectives.length)]!
      const noun = familyNouns[family][Math.floor(rand() * familyNouns[family].length)]!
      base = `${adj} ${noun}`
    } while (usedNames.has(base))
    usedNames.add(base)
    let token: string
    do token = String(1 + Math.floor(rand() * 998)).padStart(3, '0')
    while (usedTokens.has(token))
    usedTokens.add(token)

    // preços concentrados abaixo de 3 ETH, dentro da faixa do Figma (0,02 – 12,30)
    const price = (0.05 + Math.pow(rand(), 2.2) * 8.9).toFixed(2)
    // ~12% são lançamentos recentes (aba "Novos lançamentos")
    const daysAgo = rand() < 0.12 ? 1 + Math.floor(rand() * 15) : 17 + Math.floor(rand() * 380)
    const soldOutUnique = rand() < 0.35
    return {
      name: `${base} #${token}`,
      family,
      category,
      network: networkSlots[i]!,
      price,
      compareAtPrice: rand() < 0.08 ? (Number(price) * 1.18).toFixed(2) : undefined,
      daysAgo,
      popularity: 5 + Math.floor(rand() * 90),
      badge: rand() < 0.04 ? 'RARO' : undefined,
      stock: [soldOutUnique ? 0 : 1, 1 + Math.floor(rand() * 9), 3 + Math.floor(rand() * 45), 500],
    }
  })

  // NFTs multichain: rede adicional diferente da principal
  const pool = shuffle(slots(SECONDARY_NETWORK_TARGETS, {}), rand)
  const candidates = shuffle(
    generated.map((_, i) => i),
    rand,
  )
  for (const network of pool) {
    const index = candidates.findIndex((i) => generated[i]!.network !== network)
    const [chosen] = candidates.splice(index, 1)
    generated[chosen!]!.extraNetworks = [network]
  }
  return generated
}

function labelNetwork(n: NetworkId) {
  return n === 'ethereum' ? 'Ethereum' : n === 'polygon' ? 'Polygon' : 'Solana'
}

export const coupons: Record<string, { description: string; kind: 'percent' | 'fixed'; value: string; expired?: boolean }> = {
  KURIO10: { description: '10% de desconto no lançamento', kind: 'percent', value: '0.10' },
  GENESIS: { description: '0.05 ETH de desconto', kind: 'fixed', value: '0.05' },
  VERAO2025: { description: 'Campanha de verão 2025', kind: 'percent', value: '0.15', expired: true },
}

export const networkFees: Record<NetworkId, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.0005',
}

/** Limite de unidades por item no carrinho, além da disponibilidade */
export const MAX_QTY_PER_ITEM = 10
