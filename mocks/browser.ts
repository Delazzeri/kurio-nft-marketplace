import { setupWorker } from 'msw/browser'
import { mockControl } from './control'
import { accountHandlers } from './handlers/account'
import { authHandlers } from './handlers/auth'
import { cartHandlers } from './handlers/cart'
import { catalogHandlers } from './handlers/catalog'
import { checkoutHandlers } from './handlers/checkout'
import { realtimeHandlers } from './realtime'

export const handlers = [
  ...authHandlers,
  ...catalogHandlers,
  ...cartHandlers,
  ...checkoutHandlers,
  ...accountHandlers,
  ...realtimeHandlers,
]

export async function startMocks() {
  const worker = setupWorker(...handlers)
  window.__kurioMock = mockControl
  await worker.start({
    onUnhandledRequest(request, print) {
      const url = new URL(request.url)
      // assets estáticos, fontes e HMR do Vite seguem para a rede
      if (url.pathname.startsWith('/api')) print.warning()
    },
    quiet: true,
  })
  return worker
}
