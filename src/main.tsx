import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { markNetworkReady } from './app/mocks-ready'
import './styles.css'

// Camada de mocks ativada por configuração (inclusive no build de demonstração).
// Ela inicia em paralelo com o primeiro render: o shell e os skeletons aparecem na hora e
// as requisições REST/Socket.IO aguardam `mocksReady` (ver api/client e RealtimeProvider).
if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
  import('@mocks/browser')
    .then(({ startMocks }) => startMocks())
    .catch((error) => console.error('[mocks] falha ao iniciar o MSW', error))
    .finally(markNetworkReady)
} else {
  markNetworkReady()
}

async function bootstrap() {
  const { App } = await import('./app/App')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
