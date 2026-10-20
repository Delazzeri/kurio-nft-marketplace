/**
 * Resolve quando a camada de rede está pronta (MSW iniciado, ou imediatamente sem mocks).
 * O app renderiza antes disso (shell + skeletons); requisições REST e o Socket.IO aguardam.
 */
let resolveReady!: () => void

export const mocksReady: Promise<void> = new Promise((resolve) => {
  resolveReady = resolve
})

export function markNetworkReady() {
  resolveReady()
}
