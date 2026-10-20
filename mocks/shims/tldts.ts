/**
 * Shim de `tldts` para o bundle do navegador.
 *
 * O MSW usa `tough-cookie` (cookie store dos handlers), que importa `tldts` com a lista completa
 * de sufixos públicos (~100 KB+). O app não usa cookies; a aproximação "últimos dois rótulos"
 * é suficiente para o cookie store simulado e tira esse peso do caminho crítico.
 * Aplicado via `resolve.alias` no vite.config.ts.
 */
export function getDomain(domain: string): string | null {
  const parts = domain.split('.').filter(Boolean)
  if (parts.length === 0) return null
  return parts.slice(-2).join('.')
}

export function getPublicSuffix(domain: string): string | null {
  const parts = domain.split('.').filter(Boolean)
  return parts.at(-1) ?? null
}
