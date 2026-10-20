/** Só aceita destinos internos (evita open redirect). */
export function safeRedirect(target: string | undefined) {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/'
  if (target.startsWith('/entrar') || target.startsWith('/cadastro')) return '/'
  return target
}
