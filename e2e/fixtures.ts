import { test as base, expect, type Page } from '@playwright/test'
import type { MockControl } from '../mocks/control'

export const USERS = {
  ana: { email: 'ana@kurio.dev', password: 'Kurio@2026', name: 'Ana Colecionadora' },
  bruno: { email: 'bruno@kurio.dev', password: 'Kurio@2026', name: 'Bruno Cripto' },
} as const

type ScenarioId =
  | 'padrao'
  | 'instantaneo'
  | 'lento'
  | 'latencia-variavel'
  | 'catalogo-vazio'
  | 'offline'
  | 'erro-servidor'
  | 'instavel'
  | 'favoritos-falha'
  | 'sessao-curta'
  | 'preco-alterado'
  | 'edicao-esgotada'
  | 'timeout-pedido'
  | 'pagamento-recusado'
  | 'carteira-recusa'
  | 'pagamento-lento'

/**
 * Acesso à API de controle do mock que roda DENTRO da página (MSW).
 * As mudanças passam pelo banco do mock → REST e Socket.IO (socket.io-client real) refletem.
 */
export class Mock {
  constructor(private readonly page: Page) {}

  async ready() {
    await this.page.waitForFunction(() => !!window.__kurioMock)
  }

  async call<K extends keyof MockControl>(method: K, ...args: Parameters<MockControl[K]>): Promise<Awaited<ReturnType<MockControl[K]>>> {
    await this.ready()
    return this.page.evaluate(
      ([m, a]) => {
        const control = window.__kurioMock as unknown as Record<string, (...x: unknown[]) => unknown>
        return control[m as string]!(...(a as unknown[]))
      },
      [method, args] as const,
    ) as Promise<Awaited<ReturnType<MockControl[K]>>>
  }

  /** Espera até haver conexão Socket.IO aberta (opcionalmente autenticada). */
  async waitForSocket(authenticated = false) {
    await this.ready()
    await expect
      .poll(async () => {
        const users = await this.call('realtimeConnections')
        return authenticated ? users.some((u) => !!u) : users.length > 0
      })
      .toBe(true)
  }
}

type Fixtures = {
  scenario: ScenarioId
  mock: Mock
  app: App
}

export class App {
  constructor(
    readonly page: Page,
    readonly mock: Mock,
  ) {}

  get isMobile() {
    return (this.page.viewportSize()?.width ?? 1440) < 768
  }

  async goto(path: string) {
    await this.page.goto(path)
    await this.mock.ready()
  }

  /** Login pela UI (fluxo real: formulário → MSW → sessão). */
  async login(user: keyof typeof USERS = 'ana', redirect = '/') {
    await this.goto(`/entrar?redirect=${encodeURIComponent(redirect)}`)
    await this.page.getByLabel('E-mail', { exact: true }).fill(USERS[user].email)
    await this.page.getByLabel('Senha', { exact: true }).fill(USERS[user].password)
    await this.page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await this.page.waitForURL((url) => !url.pathname.startsWith('/entrar'))
  }

  /** Adiciona ao carrinho pelo detalhe (edição padrão 1/50). */
  async addToCart(nftId: string, { quantity = 1, goToCart = false }: { quantity?: number; goToCart?: boolean } = {}) {
    await this.goto(`/nft/${nftId}`)
    const increase = this.page.getByRole('button', { name: 'Aumentar quantidade' })
    for (let i = 1; i < quantity; i++) await increase.click()
    if (goToCart) {
      await this.page.getByRole('button', { name: this.isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
      await this.page.waitForURL('**/carrinho')
    } else if (this.isMobile) {
      await this.page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
      await expect(this.page.getByTestId('live-polite')).toContainText('adicionado ao carrinho')
    } else {
      // desktop: COMPRAR adiciona e navega; volta para continuar o fluxo
      await this.page.getByRole('button', { name: 'COMPRAR', exact: true }).click()
      await this.page.waitForURL('**/carrinho')
    }
  }

  /** Chega ao pagamento logado, com a carteira principal conectada via MetaMask. */
  async checkoutReady() {
    await this.page.goto('/pagamento')
    await this.page.getByRole('heading', { name: 'Perfil do colecionador' }).waitFor()
    await this.page.getByRole('radio', { name: 'MetaMask' }).check()
    await expect(this.page.getByRole('button', { name: /Conectada/ })).toBeVisible()
  }

  async confirmPurchase(expectedTotal?: string) {
    await this.page.getByRole('button', { name: 'Revisar e confirmar compra' }).click()
    const dialog = this.page.getByRole('dialog', { name: 'Revise seu pedido' })
    await expect(dialog).toBeVisible()
    if (expectedTotal) await expect(dialog.getByTestId('total')).toHaveText(expectedTotal)
    await dialog.getByRole('button', { name: 'Confirmar compra' }).click()
    return dialog
  }
}

export const test = base.extend<Fixtures>({
  scenario: ['instantaneo', { option: true }],
  mock: async ({ page }, use) => {
    await use(new Mock(page))
  },
  app: async ({ page, mock, scenario }, use) => {
    // cenário definido antes do carregamento: o banco do mock inicia já configurado
    await page.addInitScript((id) => {
      if (!sessionStorage.getItem('kurio:e2e-init')) {
        localStorage.setItem('kurio:mock:scenario', id)
        sessionStorage.setItem('kurio:e2e-init', '1')
      }
    }, scenario)
    await use(new App(page, mock))
  },
})

export { expect }
