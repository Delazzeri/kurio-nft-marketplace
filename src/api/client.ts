import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import type { ZodType } from 'zod'
import { guestCart, sessionStore } from '@/auth/session-store'
import { mocksReady } from '@/app/mocks-ready'
import { apiErrorSchema } from './contracts'
import { ApiError, isApiError } from './errors'

export { ApiError, isApiError }

export const REQUEST_TIMEOUT_MS = 10_000

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use(async (config) => {
  // nenhuma chamada sai antes da camada de rede (MSW) estar pronta
  await mocksReady
  const { token } = sessionStore.get()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  else config.headers.set('X-Cart-Id', guestCart.id())
  return config
})


function normalize(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) return new ApiError({ status: 0, code: 'ABORTED', message: 'Requisição cancelada.', retryable: false })
  if (error instanceof AxiosError) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({ status: 0, code: 'TIMEOUT', message: 'O servidor demorou para responder. Tente novamente.', retryable: true })
    }
    if (!error.response) {
      return new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Sem conexão com o servidor. Verifique sua internet.', retryable: true })
    }
    const parsed = apiErrorSchema.safeParse(error.response.data)
    if (parsed.success) {
      const e = parsed.data.error
      return new ApiError({ status: error.response.status, code: e.code, message: e.message, fields: e.fields, details: e.details, retryable: e.retryable })
    }
    return new ApiError({ status: error.response.status, code: 'INTERNAL_ERROR', message: 'Erro inesperado no servidor.' })
  }
  return new ApiError({ status: 0, code: 'INTERNAL_ERROR', message: 'Erro inesperado.' })
}

http.interceptors.response.use(
  (r) => r,
  (error) => {
    const apiError = normalize(error)
    // sessão inválida/expirada numa chamada autenticada → encerra e preserva contexto (ver SessionWatcher)
    // (só se o token usado ainda é o atual — evita derrubar uma sessão nova por resposta atrasada)
    const sentAuth = error instanceof AxiosError ? String(error.config?.headers?.Authorization ?? '') : ''
    const current = sessionStore.get().token
    if (apiError.status === 401 && current && sentAuth === `Bearer ${current}`) {
      sessionStore.end('expired')
    }
    return Promise.reject(apiError)
  },
)

/** Requisição com validação de contrato da resposta. */
export async function request<T>(schema: ZodType<T>, config: AxiosRequestConfig): Promise<T> {
  const response = await http.request(config)
  const parsed = schema.safeParse(response.data)
  if (!parsed.success) {
    if (import.meta.env.DEV) console.error('[contrato]', config.url, parsed.error.issues)
    throw new ApiError({ status: response.status, code: 'INVALID_RESPONSE', message: 'Resposta inesperada do servidor.' })
  }
  return parsed.data
}
