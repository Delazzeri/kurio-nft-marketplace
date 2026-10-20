import { HttpResponse, http } from 'msw'
import { loginInputSchema, registerInputSchema, type Session, type User } from '@/api/contracts'
import { createSession, db, hashPassword, persist } from '../db'
import { API, apiError, authenticate, parseBody, withNetwork } from '../http'
import type { SeedUser } from '../seed'

export function toUser(u: SeedUser): User {
  return { id: u.id, email: u.email, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl }
}

function toSession(u: SeedUser, token: string, expiresAt: number): Session {
  return { token, expiresAt: new Date(expiresAt).toISOString(), user: toUser(u) }
}

export const authHandlers = [
  http.post(
    `${API}/auth/register`,
    withNetwork(async ({ request }) => {
      const body = await parseBody(request, registerInputSchema)
      if (!body.ok) return body.response
      const { email, username, password } = body.data
      const fields: Record<string, string> = {}
      if (db.state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) fields.email = 'Este e-mail já está cadastrado.'
      if (db.state.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) fields.username = 'Este nome de usuário já está em uso.'
      if (Object.keys(fields).length > 0) {
        return apiError(409, fields.email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN', 'Já existe uma conta com esses dados.', { fields })
      }
      const salt = crypto.randomUUID()
      const user: SeedUser = {
        id: db.nextId('usr'),
        email,
        username,
        displayName: username,
        ensName: username.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        walletNickname: '',
        avatarUrl: null,
        salt,
        passwordHash: await hashPassword(salt, password),
        updatedAt: new Date().toISOString(),
      }
      db.state.users.push(user)
      db.state.favorites[user.id] = []
      db.state.wallets[user.id] = { primary: null, secondary: null }
      const session = createSession(user.id)
      persist()
      return HttpResponse.json(toSession(user, session.token, session.expiresAt), { status: 201 })
    }),
  ),

  http.post(
    `${API}/auth/login`,
    withNetwork(async ({ request }) => {
      const body = await parseBody(request, loginInputSchema)
      if (!body.ok) return body.response
      const user = db.state.users.find((u) => u.email.toLowerCase() === body.data.email.toLowerCase())
      const hash = user ? await hashPassword(user.salt, body.data.password) : null
      if (!user || hash !== user.passwordHash) {
        return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
      }
      const session = createSession(user.id)
      return HttpResponse.json(toSession(user, session.token, session.expiresAt))
    }),
  ),

  http.get(
    `${API}/auth/session`,
    withNetwork(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      return HttpResponse.json(toSession(auth.user, auth.session.token, auth.session.expiresAt))
    }),
  ),

  http.post(
    `${API}/auth/logout`,
    withNetwork(({ request }) => {
      const header = request.headers.get('authorization')
      const token = header?.startsWith('Bearer ') ? header.slice(7) : null
      const session = token ? db.state.sessions[token] : undefined
      if (session) {
        session.revoked = true
        persist()
      }
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
