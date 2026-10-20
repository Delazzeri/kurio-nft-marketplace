/**
 * Cenários de mock — configuráveis por URL (?cenario=<id>), pelo painel de mocks
 * ou por `window.__kurioMock.setScenario(id)` (Playwright).
 * Latência usa PRNG com seed fixa: a mesma sequência de requisições produz os mesmos atrasos.
 */

export type FailureEffect =
  | { kind: 'network-error' }
  | { kind: 'timeout' }
  | { kind: 'http'; status: number; code: string; message: string; retryable?: boolean }

export interface FailureRule {
  method?: string
  /** Regex aplicada ao pathname, ex.: /^\/api\/nfts$/ */
  path: RegExp
  effect: FailureEffect
  /** Aplica somente às N primeiras requisições correspondentes (depois a rede "volta") */
  times?: number
}

export interface Scenario {
  id: string
  label: string
  description: string
  /** [min, max] em ms */
  latency: [number, number]
  failures?: FailureRule[]
  flags?: Partial<{
    emptyCatalog: boolean
    /** Preço sobe ao enviar o pedido (cotação desatualizada) */
    priceChangeOnCheckout: boolean
    /** Edição esgota ao enviar o pedido */
    soldOutOnCheckout: boolean
    /** Pedido é criado mas a resposta demora mais que o timeout do cliente */
    orderTimeout: boolean
    paymentDeclined: boolean
    walletRejected: boolean
    /** Sessão expira em 45 s após o login */
    shortSession: boolean
    /** Tempo de liquidação do pagamento (ms) */
    paymentDelayMs: number
  }>
}

const api = (p: string) => new RegExp(`^/api${p}$`)

export const scenarios: Scenario[] = [
  {
    id: 'padrao',
    label: 'Padrão',
    description: 'Sucesso com latência realista (150–450 ms).',
    latency: [150, 450],
  },
  {
    id: 'instantaneo',
    label: 'Instantâneo',
    description: 'Sem latência — usado nos testes.',
    latency: [0, 0],
    flags: { paymentDelayMs: 1500 },
  },
  {
    id: 'lento',
    label: 'Rede lenta',
    description: 'Todas as respostas demoram ~2,5 s (skeletons visíveis).',
    latency: [2400, 2600],
  },
  {
    id: 'latencia-variavel',
    label: 'Latência variável',
    description: 'Atrasos entre 50 ms e 2,5 s — respostas chegam fora de ordem.',
    latency: [50, 2500],
  },
  {
    id: 'catalogo-vazio',
    label: 'Catálogo vazio',
    description: 'A busca de NFTs não retorna resultados.',
    latency: [150, 300],
    flags: { emptyCatalog: true },
  },
  {
    id: 'offline',
    label: 'Sem conexão',
    description: 'Toda requisição REST falha por erro de rede.',
    latency: [100, 200],
    failures: [{ path: /^\/api\//, effect: { kind: 'network-error' } }],
  },
  {
    id: 'erro-servidor',
    label: 'Erro 500 no catálogo',
    description: 'Listagem e detalhe respondem 500.',
    latency: [150, 300],
    failures: [
      {
        method: 'GET',
        path: /^\/api\/nfts(\/[^/]+)?$/,
        effect: { kind: 'http', status: 500, code: 'INTERNAL_ERROR', message: 'Erro inesperado no servidor.', retryable: true },
      },
    ],
  },
  {
    id: 'instavel',
    label: 'Instável (503 e recupera)',
    description: 'As 3 primeiras chamadas de catálogo retornam 503; novas tentativas funcionam.',
    latency: [150, 300],
    failures: [
      {
        method: 'GET',
        path: /^\/api\/nfts/,
        times: 3,
        effect: { kind: 'http', status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Serviço temporariamente indisponível.', retryable: true },
      },
    ],
  },
  {
    id: 'favoritos-falha',
    label: 'Falha ao favoritar',
    description: 'Incluir/remover favorito falha com 500 (rollback otimista).',
    latency: [200, 400],
    failures: [
      {
        method: 'PUT',
        path: api('/me/favorites/[^/]+'),
        effect: { kind: 'http', status: 500, code: 'INTERNAL_ERROR', message: 'Não foi possível salvar o favorito.', retryable: true },
      },
      {
        method: 'DELETE',
        path: api('/me/favorites/[^/]+'),
        effect: { kind: 'http', status: 500, code: 'INTERNAL_ERROR', message: 'Não foi possível remover o favorito.', retryable: true },
      },
    ],
  },
  {
    id: 'sessao-curta',
    label: 'Sessão expira em 45 s',
    description: 'Após o login, a sessão expira em 45 segundos.',
    latency: [150, 300],
    flags: { shortSession: true },
  },
  {
    id: 'preco-alterado',
    label: 'Preço alterado no checkout',
    description: 'Ao confirmar a compra, o preço do primeiro item sobe 0.10 ETH.',
    latency: [150, 300],
    flags: { priceChangeOnCheckout: true },
  },
  {
    id: 'edicao-esgotada',
    label: 'Edição esgotada no checkout',
    description: 'Ao confirmar a compra, a edição do primeiro item esgota.',
    latency: [150, 300],
    flags: { soldOutOnCheckout: true },
  },
  {
    id: 'timeout-pedido',
    label: 'Timeout após criar pedido',
    description: 'O pedido é criado, mas a resposta excede o timeout; o reenvio recupera o mesmo pedido.',
    latency: [150, 300],
    flags: { orderTimeout: true },
  },
  {
    id: 'pagamento-recusado',
    label: 'Pagamento recusado',
    description: 'O pedido é criado e depois recusado pela carteira.',
    latency: [150, 300],
    flags: { paymentDeclined: true },
  },
  {
    id: 'carteira-recusa',
    label: 'Carteira recusa conexão',
    description: 'A conexão simulada da carteira é recusada.',
    latency: [150, 300],
    flags: { walletRejected: true },
  },
  {
    id: 'pagamento-lento',
    label: 'Pagamento lento (12 s)',
    description: 'O pedido fica pendente por 12 s — útil para testar desconexão e retomada.',
    latency: [150, 300],
    flags: { paymentDelayMs: 12_000 },
  },
]

export const DEFAULT_SCENARIO = 'padrao'

export function getScenarioById(id: string | null | undefined): Scenario {
  return scenarios.find((s) => s.id === id) ?? scenarios.find((s) => s.id === DEFAULT_SCENARIO)!
}

/** PRNG determinístico (mulberry32) */
export function createRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
