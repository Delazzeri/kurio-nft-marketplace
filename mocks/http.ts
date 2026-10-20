import { HttpResponse, delay, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { ZodType } from 'zod'
import type { ErrorCode } from '@/api/contracts'
import { db, persist, type StoredSession } from './db'
import type { SeedUser } from './seed'

export const API = '/api'

export function apiError(
  status: number,
  code: ErrorCode,
  message: string,
  extra: { fields?: Record<string, string>; details?: unknown; retryable?: boolean } = {},
) {
  return HttpResponse.json({ error: { code, message, ...extra } }, { status })
}

/**
 * Envolve um resolver aplicando a latência do cenário e as regras de falha
 * (erro de rede, timeout, HTTP 4xx/5xx). Componentes e cliente não sabem que é mock.
 */
export function withNetwork<P extends PathParams, B extends DefaultBodyType>(
  resolver: HttpResponseResolver<P, B>,
): HttpResponseResolver<P, B> {
  return async (info) => {
    const { request } = info
    const url = new URL(request.url)
    const rules = db.scenario.failures ?? []
    for (const [index, rule] of rules.entries()) {
      if (rule.method && rule.method !== request.method) continue
      if (!rule.path.test(url.pathname)) continue
      const key = `${db.scenario.id}:${index}`
      const hit = db.failureHit(key)
      if (rule.times !== undefined && hit > rule.times) continue
      await delay(db.latency())
      switch (rule.effect.kind) {
        case 'network-error':
          return HttpResponse.error()
        case 'timeout':
          await delay('infinite')
          return HttpResponse.error()
        case 'http':
          return apiError(rule.effect.status, rule.effect.code as ErrorCode, rule.effect.message, {
            retryable: rule.effect.retryable,
          })
      }
    }
    await delay(db.latency())
    return resolver(info)
  }
}

export type AuthResult =
  | { ok: true; user: SeedUser; session: StoredSession }
  | { ok: false; response: Response }

export function authenticate(request: Request): AuthResult {
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return { ok: false, response: apiError(401, 'UNAUTHENTICATED', 'Faça login para continuar.') }
  const session = db.state.sessions[token]
  if (!session || session.revoked) {
    return { ok: false, response: apiError(401, 'UNAUTHENTICATED', 'Sessão inválida. Faça login novamente.') }
  }
  if (session.expiresAt <= Date.now()) {
    return { ok: false, response: apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.') }
  }
  const user = db.state.users.find((u) => u.id === session.userId)
  if (!user) return { ok: false, response: apiError(401, 'UNAUTHENTICATED', 'Usuário não encontrado.') }
  return { ok: true, user, session }
}

/** Autenticação opcional: token inválido/expirado ainda gera 401 (o cliente precisa saber). */
export function optionalAuth(request: Request): AuthResult | { ok: true; user: null; session: null } {
  if (!request.headers.get('authorization')) return { ok: true, user: null, session: null }
  return authenticate(request)
}

export async function parseBody<T>(request: Request, schema: ZodType<T>) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false as const, response: apiError(400, 'VALIDATION_ERROR', 'Corpo da requisição inválido.') }
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const fields: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.')
      if (!fields[key]) fields[key] = issue.message
    }
    return {
      ok: false as const,
      response: apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fields }),
    }
  }
  return { ok: true as const, data: result.data }
}

export { persist }
