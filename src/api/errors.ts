/**
 * Erro de API normalizado. Módulo leve (sem axios/zod) para que o shell do app — QueryClient,
 * estados de erro, layout — não precise carregar a camada HTTP antes da primeira pintura.
 */
import type { ErrorCode } from './contracts'

/** Erro normalizado — a UI nunca lida com AxiosError diretamente. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'ABORTED' | 'INVALID_RESPONSE'
  readonly fields?: Record<string, string>
  readonly details?: unknown
  readonly retryable: boolean

  constructor(init: {
    status: number
    code: ApiError['code']
    message: string
    fields?: Record<string, string>
    details?: unknown
    retryable?: boolean
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fields = init.fields
    this.details = init.details
    this.retryable = init.retryable ?? (init.status === 0 || init.status >= 500)
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}
