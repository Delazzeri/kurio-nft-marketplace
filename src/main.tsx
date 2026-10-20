import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

async function bootstrap() {
  // camada de mocks ativada por configuração (inclusive no build de demonstração)
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    const { startMocks } = await import('@mocks/browser')
    await startMocks()
  }
  // O App (e o socket.io-client) só é carregado depois do MSW: o engine.io-client captura
  // `globalThis.WebSocket` na avaliação do módulo, e o interceptor precisa estar instalado antes.
  const { App } = await import('./app/App')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
