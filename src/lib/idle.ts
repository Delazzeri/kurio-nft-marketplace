import { useEffect, useState } from 'react'

/**
 * Resolve depois do evento `load`, quando o navegador fica ocioso (timeout de segurança).
 * Usado para o que não é necessário na primeira tela — toasts, conexão em tempo real e o painel
 * de mocks — não disputar a thread principal com a pintura do conteúdo (LCP).
 */
export const afterLoadIdle: Promise<void> = new Promise((resolve) => {
  if (typeof window === 'undefined') return resolve()
  const idle = () =>
    typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(() => resolve(), { timeout: 1500 }) : setTimeout(resolve, 200)
  if (document.readyState === 'complete') idle()
  else window.addEventListener('load', idle, { once: true })
})

export function useAfterLoadIdle() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    void afterLoadIdle.then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])
  return ready
}
