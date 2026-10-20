/**
 * Contratos REST e de eventos — fonte única de tipos.
 * Usados pelo cliente (validação das respostas do Axios), pelos hooks/UI e pelos handlers MSW.
 */
import { z } from 'zod'

/** Valor decimal em ETH como string (ex.: "1.19"). Nunca number. */
export const ethString = z.string().regex(/^\d+(\.\d+)?$/, 'Valor ETH inválido')

/* ------------------------------------------------------------------ Erros */

export const errorCodes = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'INVALID_CREDENTIALS',
  'AVAILABILITY_CONFLICT',
  'QUOTE_STALE',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'IDEMPOTENCY_CONFLICT',
  'WALLET_REJECTED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const
export type ErrorCode = (typeof errorCodes)[number]

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(errorCodes),
    message: z.string(),
    /** Erros por campo (validação de formulário). */
    fields: z.record(z.string(), z.string()).optional(),
    /** Dados extras (ex.: nova cotação em QUOTE_STALE). */
    details: z.unknown().optional(),
    retryable: z.boolean().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorSchema>

/* ------------------------------------------------------------------ Catálogo */

export * from './constants'
import { catalogTabIds, categoryIds, networkIds, sortIds, walletTypeIds } from './constants'

export const editionSchema = z.object({
  id: z.string(),
  /** Rótulo exibido: "1/1", "1/10", "1/50", "ABERTA" */
  label: z.string(),
  price: ethString,
  /** Preço anterior (riscado) quando há promoção */
  compareAtPrice: ethString.optional(),
  /** Unidades disponíveis para compra */
  available: z.number().int().nonnegative(),
  /** Tamanho da edição (null = aberta) */
  supply: z.number().int().positive().nullable(),
})
export type Edition = z.infer<typeof editionSchema>

export const nftSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  collection: z.object({ id: z.string(), name: z.string() }),
  category: z.enum(categoryIds),
  /** Rede principal (cunhagem) */
  network: z.enum(networkIds),
  /** Todas as redes em que o NFT está listado (multichain inclui a principal) */
  networks: z.array(z.enum(networkIds)).min(1),
  /** Menor preço entre edições disponíveis (ou da edição padrão se esgotado) */
  price: ethString,
  compareAtPrice: ethString.optional(),
  /** Soma das unidades disponíveis */
  available: z.number().int().nonnegative(),
  badge: z.string().optional(),
  listedAt: z.string(),
  popularity: z.number(),
  /** Versão monotônica do recurso — usada para ordenar eventos e respostas */
  version: z.number().int(),
})
export type NftSummary = z.infer<typeof nftSummarySchema>

export const nftDetailSchema = nftSummarySchema.extend({
  description: z.string(),
  story: z.array(z.string()),
  gallery: z.array(z.object({ src: z.string(), alt: z.string() })),
  attributes: z.array(z.string()),
  rating: z.number(),
  reviewsCount: z.number().int(),
  contract: z.string(),
  royalties: z.string(),
  editions: z.array(editionSchema),
  defaultEditionId: z.string(),
})
export type NftDetail = z.infer<typeof nftDetailSchema>

export const nftListQuerySchema = z.object({
  q: z.string().optional(),
  categories: z.array(z.enum(categoryIds)).optional(),
  networks: z.array(z.enum(networkIds)).optional(),
  minPrice: ethString.optional(),
  maxPrice: ethString.optional(),
  tab: z.enum(catalogTabIds).optional(),
  sort: z.enum(sortIds).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(48).optional(),
})
export type NftListQuery = z.infer<typeof nftListQuerySchema>

export const facetSchema = z.object({ id: z.string(), label: z.string(), count: z.number().int() })

export const nftListResponseSchema = z.object({
  items: z.array(nftSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  facets: z.object({
    categories: z.array(facetSchema),
    networks: z.array(facetSchema),
    priceRange: z.object({ min: ethString, max: ethString }),
  }),
  /** Eco dos parâmetros efetivamente aplicados pela API */
  appliedQuery: nftListQuerySchema,
})
export type NftListResponse = z.infer<typeof nftListResponseSchema>

/* ------------------------------------------------------------------ Sessão e conta */

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof userSchema>

export const sessionSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: userSchema,
})
export type Session = z.infer<typeof sessionSchema>

const password = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')

export const loginInputSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  password: z.string().min(1, 'Informe sua senha'),
})
export type LoginInput = z.infer<typeof loginInputSchema>

export const registerInputSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'Mínimo de 3 caracteres')
      .max(24, 'Máximo de 24 caracteres')
      .regex(/^[a-z0-9_.]+$/i, 'Use apenas letras, números, "_" ou "."'),
    email: z.string().trim().min(1, 'Informe seu e-mail').email('E-mail inválido'),
    password,
    confirmPassword: z.string().min(1, 'Confirme sua senha'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  })
export type RegisterInput = z.infer<typeof registerInputSchema>

/* ------------------------------------------------------------------ Perfil */

export const profileSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  username: z.string(),
  email: z.string(),
  ensName: z.string(),
  walletNickname: z.string(),
  avatarUrl: z.string().nullable(),
  updatedAt: z.string(),
})
export type Profile = z.infer<typeof profileSchema>

export const profileInputSchema = z.object({
  displayName: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(40, 'Máximo de 40 caracteres'),
  username: z
    .string()
    .trim()
    .min(3, 'Mínimo de 3 caracteres')
    .max(24, 'Máximo de 24 caracteres')
    .regex(/^[a-z0-9_.]+$/i, 'Use apenas letras, números, "_" ou "."'),
  email: z.string().trim().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  ensName: z
    .string()
    .trim()
    .min(3, 'Mínimo de 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Use letras minúsculas, números ou "-"'),
  walletNickname: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(32, 'Máximo de 32 caracteres'),
})
export type ProfileInput = z.infer<typeof profileInputSchema>

export const avatarInputSchema = z.object({
  /** data URL (image/png | image/jpeg | image/webp), até ~1MB */
  dataUrl: z.string().regex(/^data:image\/(png|jpeg|webp);base64,/, 'Formato de imagem não suportado'),
})

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: password,
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  })
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>

/* ------------------------------------------------------------------ Carteiras */


export const walletInputSchema = z.object({
  displayName: z.string().trim().min(2, 'Mínimo de 2 caracteres'),
  nickname: z.string().trim().min(2, 'Mínimo de 2 caracteres'),
  network: z.enum(networkIds, { message: 'Selecione uma rede' }),
  profileName: z.string().trim().min(2, 'Mínimo de 2 caracteres'),
  address: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço inválido (0x seguido de 40 caracteres hexadecimais)'),
  secondaryAddress: z
    .string()
    .trim()
    .refine((v) => v === '' || /^0x[a-fA-F0-9]{40}$/.test(v) || /^[a-z0-9-]+\.eth$/.test(v), 'Informe um endereço 0x ou nome ENS')
    .optional()
    .default(''),
  walletType: z.enum(walletTypeIds, { message: 'Selecione uma carteira' }),
  referralCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{4,12}$/i, 'Código com 4 a 12 letras ou números'),
  email: z.string().trim().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  ensName: z
    .string()
    .trim()
    .min(3, 'Mínimo de 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Use letras minúsculas, números ou "-"'),
})
export type WalletInput = z.input<typeof walletInputSchema>

export const walletSlotSchema = z.enum(['primary', 'secondary'])
export type WalletSlot = z.infer<typeof walletSlotSchema>

export const walletSchema = z.object({
  id: z.string(),
  slot: walletSlotSchema,
  displayName: z.string(),
  nickname: z.string(),
  network: z.enum(networkIds),
  profileName: z.string(),
  address: z.string(),
  secondaryAddress: z.string(),
  walletType: z.enum(walletTypeIds),
  referralCode: z.string(),
  email: z.string(),
  ensName: z.string(),
  /** true quando a secundária replica a principal */
  sameAsPrimary: z.boolean(),
  updatedAt: z.string(),
})
export type Wallet = z.infer<typeof walletSchema>

export const walletsResponseSchema = z.object({
  primary: walletSchema.nullable(),
  secondary: walletSchema.nullable(),
})
export type WalletsResponse = z.infer<typeof walletsResponseSchema>

export const walletSessionSchema = z.object({
  id: z.string(),
  walletId: z.string(),
  network: z.enum(networkIds),
  /** Provedor usado na conexão simulada (WalletConnect, MetaMask, Coinbase) */
  provider: z.enum(walletTypeIds),
  address: z.string(),
  status: z.literal('connected'),
  connectedAt: z.string(),
})
export type WalletSession = z.infer<typeof walletSessionSchema>

/* ------------------------------------------------------------------ Favoritos */

export const favoritesResponseSchema = z.object({ nftIds: z.array(z.string()) })
export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>

/* ------------------------------------------------------------------ Carrinho */

export const cartItemSchema = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: ethString,
  lineTotal: ethString,
  /** Preço visto pelo usuário quando o item foi adicionado/reconhecido */
  acknowledgedPrice: ethString,
  /** Disponibilidade atual da edição */
  available: z.number().int().nonnegative(),
  issues: z.array(z.enum(['PRICE_CHANGED', 'INSUFFICIENT_AVAILABILITY', 'SOLD_OUT'])),
})
export type CartItem = z.infer<typeof cartItemSchema>

export const cartSchema = z.object({
  id: z.string(),
  owner: z.enum(['guest', 'user']),
  items: z.array(cartItemSchema),
  itemCount: z.number().int(),
  coupon: z.object({ code: z.string(), description: z.string() }).nullable(),
  /** Incrementa a cada alteração — usado para detectar cotação desatualizada */
  version: z.number().int(),
  updatedAt: z.string(),
})
export type Cart = z.infer<typeof cartSchema>

export const addCartItemInputSchema = z.object({
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().positive(),
})
export type AddCartItemInput = z.infer<typeof addCartItemInputSchema>

/* ------------------------------------------------------------------ Cotação */

export const quoteSchema = z.object({
  id: z.string(),
  cartVersion: z.number().int(),
  network: z.enum(networkIds),
  items: z.array(
    z.object({
      cartItemId: z.string(),
      nftId: z.string(),
      editionId: z.string(),
      editionLabel: z.string(),
      name: z.string(),
      tokenId: z.string(),
      image: z.string(),
      imageAlt: z.string(),
      quantity: z.number().int(),
      unitPrice: ethString,
      lineTotal: ethString,
      /** versão do NFT usada na cotação */
      nftVersion: z.number().int(),
    }),
  ),
  coupon: z.object({ code: z.string(), description: z.string() }).nullable(),
  subtotal: ethString,
  discount: ethString,
  networkFee: ethString,
  total: ethString,
  /** Problemas que impedem a compra (disponibilidade, preço etc.) */
  blockingIssues: z.array(z.object({ cartItemId: z.string(), code: z.string(), message: z.string() })),
  createdAt: z.string(),
  expiresAt: z.string(),
})
export type Quote = z.infer<typeof quoteSchema>

/* ------------------------------------------------------------------ Pedidos */

export const orderStatusSchema = z.enum(['pending', 'confirmed', 'declined'])
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const buyerSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição'),
  username: z.string().trim().min(3, 'Informe o nome de usuário'),
  profileName: z.string().trim().min(2, 'Informe o nome do perfil'),
  email: z.string().trim().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  ensName: z
    .string()
    .trim()
    .min(3, 'Informe o nome ENS')
    .regex(/^[a-z0-9-]+$/, 'Use letras minúsculas, números ou "-"'),
  referralCode: z.string().trim().regex(/^[A-Z0-9]{4,12}$/i, 'Código com 4 a 12 letras ou números'),
  note: z.string().max(280, 'Máximo de 280 caracteres').optional().default(''),
})
export type Buyer = z.input<typeof buyerSchema>

export const createOrderInputSchema = z.object({
  quoteId: z.string(),
  walletId: z.string(),
  walletSessionId: z.string(),
  network: z.enum(networkIds),
  buyer: buyerSchema,
})
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>

export const orderSchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
  /** Motivo da recusa quando status = declined */
  declineReason: z.string().nullable(),
  version: z.number().int(),
  idempotencyKey: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Snapshot imutável — o recibo nunca lê o catálogo atual */
  receipt: z.object({
    items: quoteSchema.shape.items,
    subtotal: ethString,
    discount: ethString,
    networkFee: ethString,
    total: ethString,
    coupon: quoteSchema.shape.coupon,
    network: z.enum(networkIds),
    wallet: z.object({ id: z.string(), label: z.string(), address: z.string() }),
    buyer: z.object({ displayName: z.string(), email: z.string() }),
  }),
  transaction: z
    .object({ hash: z.string(), explorerUrl: z.string(), confirmedAt: z.string() })
    .nullable(),
})
export type Order = z.infer<typeof orderSchema>

/* ------------------------------------------------------------------ Eventos Socket.IO */

const eventBase = z.object({
  /** Identidade estável — duplicatas são descartadas por este id */
  eventId: z.string(),
  occurredAt: z.string(),
  /** Versão do recurso após o evento — eventos com versão <= conhecida são ignorados */
  version: z.number().int(),
})

export const nftUpdatedEventSchema = eventBase.extend({
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: z.string() }),
  data: z.object({
    price: ethString,
    available: z.number().int().nonnegative(),
    editions: z.array(editionSchema.pick({ id: true, price: true, available: true })),
    previousPrice: ethString.optional(),
  }),
})
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>

export const orderUpdatedEventSchema = eventBase.extend({
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: z.string() }),
  /** Dono do pedido — eventos de outro usuário são descartados no cliente */
  userId: z.string(),
  data: z.object({ status: orderStatusSchema, declineReason: z.string().nullable() }),
})
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>

export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent
