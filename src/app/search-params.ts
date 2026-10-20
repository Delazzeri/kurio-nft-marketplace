/**
 * Serialização legível da busca na URL: `?cat=musica,fotografia&page=2`
 * (o padrão do TanStack Router é JSON: `?cat=%5B%22musica%22%5D`).
 * Os valores chegam como string e cada rota os valida/converte com zod.
 */
export function parseSearch(search: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(search))
}

export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','))
    } else {
      params.set(key, String(value))
    }
  }
  const text = params.toString().replace(/%2C/g, ',')
  return text ? `?${text}` : ''
}
