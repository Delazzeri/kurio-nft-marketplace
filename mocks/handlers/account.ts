import { HttpResponse, http } from 'msw'
import { z } from 'zod'
import {
  avatarInputSchema,
  passwordChangeSchema,
  profileInputSchema,
  walletInputSchema,
  type Profile,
  type Wallet,
  type WalletSlot,
} from '@/api/contracts'
import { db, findNft, hashPassword, persist } from '../db'
import { API, apiError, authenticate, parseBody, withNetwork } from '../http'
import type { SeedUser } from '../seed'

function toProfile(u: SeedUser): Profile {
  return {
    id: u.id,
    displayName: u.displayName,
    username: u.username,
    email: u.email,
    ensName: u.ensName,
    walletNickname: u.walletNickname,
    avatarUrl: u.avatarUrl,
    updatedAt: u.updatedAt,
  }
}

const BLOCKED_ADDRESS = /^0x0{40}$/i

export const accountHandlers = [
  /* -------- Favoritos -------- */
  http.get(
    `${API}/me/favorites`,
    withNetwork(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      return HttpResponse.json({ nftIds: db.state.favorites[auth.user.id] ?? [] })
    }),
  ),
  http.put(
    `${API}/me/favorites/:nftId`,
    withNetwork(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const id = String(params.nftId)
      if (!findNft(id)) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
      const list = (db.state.favorites[auth.user.id] ??= [])
      if (!list.includes(id)) list.push(id)
      persist()
      return HttpResponse.json({ nftIds: list })
    }),
  ),
  http.delete(
    `${API}/me/favorites/:nftId`,
    withNetwork(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const list = (db.state.favorites[auth.user.id] ?? []).filter((x) => x !== params.nftId)
      db.state.favorites[auth.user.id] = list
      persist()
      return HttpResponse.json({ nftIds: list })
    }),
  ),

  /* -------- Perfil -------- */
  http.get(
    `${API}/me/profile`,
    withNetwork(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      return HttpResponse.json(toProfile(auth.user))
    }),
  ),
  http.patch(
    `${API}/me/profile`,
    withNetwork(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const body = await parseBody(request, profileInputSchema)
      if (!body.ok) return body.response
      const fields: Record<string, string> = {}
      const others = db.state.users.filter((u) => u.id !== auth.user.id)
      if (others.some((u) => u.email.toLowerCase() === body.data.email.toLowerCase())) fields.email = 'Este e-mail já está em uso por outra conta.'
      if (others.some((u) => u.username.toLowerCase() === body.data.username.toLowerCase())) fields.username = 'Este nome de usuário já está em uso.'
      if (Object.keys(fields).length) return apiError(409, fields.email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN', 'Revise os campos destacados.', { fields })
      Object.assign(auth.user, body.data, { updatedAt: new Date().toISOString() })
      persist()
      return HttpResponse.json(toProfile(auth.user))
    }),
  ),
  http.put(
    `${API}/me/avatar`,
    withNetwork(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const body = await parseBody(request, avatarInputSchema)
      if (!body.ok) return body.response
      if (body.data.dataUrl.length > 400_000) {
        return apiError(422, 'VALIDATION_ERROR', 'A imagem deve ter no máximo 300 KB.', { fields: { avatar: 'A imagem deve ter no máximo 300 KB.' } })
      }
      auth.user.avatarUrl = body.data.dataUrl
      auth.user.updatedAt = new Date().toISOString()
      persist()
      return HttpResponse.json(toProfile(auth.user))
    }),
  ),
  http.delete(
    `${API}/me/avatar`,
    withNetwork(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      auth.user.avatarUrl = null
      auth.user.updatedAt = new Date().toISOString()
      persist()
      return HttpResponse.json(toProfile(auth.user))
    }),
  ),
  http.post(
    `${API}/me/password`,
    withNetwork(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const body = await parseBody(request, passwordChangeSchema)
      if (!body.ok) return body.response
      const currentHash = await hashPassword(auth.user.salt, body.data.currentPassword)
      if (currentHash !== auth.user.passwordHash) {
        return apiError(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', { fields: { currentPassword: 'Senha atual incorreta.' } })
      }
      auth.user.salt = crypto.randomUUID()
      auth.user.passwordHash = await hashPassword(auth.user.salt, body.data.newPassword)
      auth.user.updatedAt = new Date().toISOString()
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  /* -------- Carteiras -------- */
  http.get(
    `${API}/me/wallets`,
    withNetwork(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      return HttpResponse.json(db.state.wallets[auth.user.id] ?? { primary: null, secondary: null })
    }),
  ),
  http.put(
    `${API}/me/wallets/:slot`,
    withNetwork(async ({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const slot = params.slot as WalletSlot
      if (slot !== 'primary' && slot !== 'secondary') return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
      const wallets = (db.state.wallets[auth.user.id] ??= { primary: null, secondary: null })

      const raw = (await request.clone().json().catch(() => null)) as { sameAsPrimary?: boolean } | null
      if (slot === 'secondary' && raw?.sameAsPrimary) {
        if (!wallets.primary) return apiError(422, 'VALIDATION_ERROR', 'Cadastre a carteira principal primeiro.')
        wallets.secondary = { ...wallets.primary, id: `wal_${auth.user.id}_secondary`, slot: 'secondary', sameAsPrimary: true, updatedAt: new Date().toISOString() }
        persist()
        return HttpResponse.json(wallets)
      }

      const body = await parseBody(request, walletInputSchema.extend({ sameAsPrimary: z.literal(false).optional() }))
      if (!body.ok) return body.response
      if (BLOCKED_ADDRESS.test(body.data.address)) {
        return apiError(422, 'VALIDATION_ERROR', 'Endereço não permitido.', { fields: { address: 'O endereço nulo (0x000…0) não pode receber NFTs.' } })
      }
      const other = slot === 'primary' ? wallets.secondary : wallets.primary
      if (other && !other.sameAsPrimary && other.address.toLowerCase() === body.data.address.toLowerCase()) {
        return apiError(409, 'CONFLICT', 'Este endereço já está cadastrado na outra carteira.', {
          fields: { address: 'Este endereço já está cadastrado na outra carteira.' },
        })
      }
      const wallet: Wallet = {
        ...body.data,
        secondaryAddress: body.data.secondaryAddress ?? '',
        id: `wal_${auth.user.id}_${slot}`,
        slot,
        sameAsPrimary: false,
        updatedAt: new Date().toISOString(),
      }
      wallets[slot] = wallet
      // secundária espelhada acompanha a principal
      if (slot === 'primary' && wallets.secondary?.sameAsPrimary) {
        wallets.secondary = { ...wallet, id: `wal_${auth.user.id}_secondary`, slot: 'secondary', sameAsPrimary: true }
      }
      persist()
      return HttpResponse.json(wallets)
    }),
  ),
  http.delete(
    `${API}/me/wallets/secondary`,
    withNetwork(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const wallets = (db.state.wallets[auth.user.id] ??= { primary: null, secondary: null })
      wallets.secondary = null
      persist()
      return HttpResponse.json(wallets)
    }),
  ),
]
