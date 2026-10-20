import { expect, test } from './fixtures'

/** Cenário 7 — falha de pagamento, clique repetido e timeout com recuperação do mesmo pedido. */
test.describe('Falhas no pagamento', () => {
  test.describe('pagamento recusado', () => {
    test.use({ scenario: 'pagamento-recusado' })
    test('mostra a recusa e preserva os itens no carrinho', async ({ app, page }) => {
      await app.login('ana')
      await app.addToCart('sage-nomad-009')
      await app.checkoutReady()
      await app.confirmPurchase()
      await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
      await expect(page.getByTestId('order-confirmed')).toHaveCount(0)
      await page.getByRole('link', { name: 'Ver carrinho' }).click()
      await expect(page.getByTestId('cart-item-sage-nomad-009')).toBeVisible()
    })
  })

  test('cliques repetidos criam um único pedido', async ({ app, page, mock }) => {
    test.skip(app.isMobile, 'lógica de idempotência independe do viewport')
    await app.login('ana')
    await app.addToCart('sage-nomad-009')
    await app.checkoutReady()
    await page.getByRole('button', { name: 'Revisar e confirmar compra' }).click()
    const confirm = page.getByRole('dialog').getByRole('button', { name: 'Confirmar compra' })
    // triplo clique no mesmo botão (eventos em sequência, antes de a UI reagir)
    await confirm.click({ clickCount: 3 })
    await expect(page).toHaveURL(/\/pedidos\//)
    const orders = await mock.call('orders')
    expect(orders).toHaveLength(1)
  })

  test.describe('timeout após criar o pedido', () => {
    test.use({ scenario: 'timeout-pedido' })
    test('o reenvio com a mesma chave recupera o mesmo pedido', async ({ app, page, mock }) => {
      test.slow()
      await app.login('ana')
      await app.addToCart('sage-nomad-009')
      await app.checkoutReady()
      const keys: string[] = []
      page.on('request', (r) => {
        if (r.url().endsWith('/api/orders') && r.method() === 'POST') keys.push(r.headers()['idempotency-key'] ?? '')
      })
      await app.confirmPurchase()
      // 1ª resposta excede o timeout (10 s); o cliente reenvia com a MESMA chave
      await expect(page).toHaveURL(/\/pedidos\//, { timeout: 30_000 })
      expect(keys.length).toBeGreaterThanOrEqual(2)
      expect(new Set(keys).size).toBe(1)
      expect(await mock.call('orders')).toHaveLength(1)
      await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
    })
  })

  test.describe('carteira recusa a conexão', () => {
    test.use({ scenario: 'carteira-recusa' })
    test('não aparenta sucesso e permite tentar outro provedor', async ({ app, page }) => {
      await app.login('ana')
      await app.addToCart('sage-nomad-009')
      await page.goto('/pagamento')
      await page.getByRole('radio', { name: 'Coinbase Wallet' }).check()
      await expect(page.getByText('A conexão foi recusada na carteira').first()).toBeVisible()
      await expect(page.getByRole('button', { name: /Conectada/ })).toHaveCount(0)
      await page.getByRole('button', { name: 'Revisar e confirmar compra' }).click()
      await expect(page.getByRole('alert').filter({ hasText: 'Conecte a carteira selecionada' })).toBeVisible()
    })
  })
})
