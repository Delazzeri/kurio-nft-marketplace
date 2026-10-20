import { expect, test } from './fixtures'

/**
 * Cenários 9 e 10 — eventos passam pelo socket.io-client real: o teste altera o banco do mock,
 * que publica `nft.updated`/`order.updated` pela conexão interceptada pelo MSW.
 */
test.describe('Tempo real (Socket.IO)', () => {
  test('preço/disponibilidade mudam com o NFT no carrinho: interface informa e atualiza o resumo', async ({ app, page, mock }) => {
    await app.addToCart('ivory-baron-088', { goToCart: true })
    await expect(page.getByTestId('total')).toHaveText('1.806 ETH')
    await mock.waitForSocket()

    await mock.call('updateNft', 'ivory-baron-088', { priceDelta: '0.20' })
    await expect(page.getByTestId('live-assertive')).toContainText('mudou de 1.79 ETH para 1.99 ETH')
    await expect(page.getByTestId('total')).toHaveText('2.006 ETH')
    await expect(page.getByText('Preço alterado de 1.79 ETH para 1.99 ETH.').locator('visible=true')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()
    await page.getByRole('button', { name: 'Ok, entendi' }).locator('visible=true').click()
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeEnabled()

    await mock.call('updateNft', 'ivory-baron-088', { available: 0 })
    await expect(page.getByText('Esta edição esgotou. Remova o item para continuar.').locator('visible=true')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()
  })

  test('checkout impede confirmar com cotação desatualizada e exige nova confirmação', async ({ app, page, mock }) => {
    await app.login('ana')
    await app.addToCart('sage-nomad-009')
    await app.checkoutReady()
    await mock.waitForSocket(true)
    await page.getByRole('button', { name: 'Revisar e confirmar compra' }).click()
    const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
    await expect(dialog.getByTestId('total')).toHaveText('1.706 ETH')

    // preço muda enquanto o diálogo de revisão está aberto
    await mock.call('updateNft', 'sage-nomad-009', { priceDelta: '0.30' })
    await expect(dialog.getByText('Os valores mudaram desde a sua revisão.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Revisar novos valores' }).click()
    await expect(dialog.getByTestId('total')).toHaveText('2.006 ETH')
    await dialog.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('order-confirmed')).toContainText('2.006 ETH')
  })

  test.describe('preço alterado no envio (409 QUOTE_STALE)', () => {
    test.use({ scenario: 'preco-alterado' })
    test('servidor rejeita a cotação antiga e a UI pede nova confirmação', async ({ app, page, mock }) => {
      await app.login('ana')
      await app.addToCart('sage-nomad-009')
      await app.checkoutReady()
      const dialog = await app.confirmPurchase()
      await expect(dialog.getByRole('alert').filter({ hasText: 'Preço, disponibilidade ou taxas mudaram' })).toBeVisible()
      await expect(dialog.getByText('Os valores mudaram desde a sua revisão.')).toBeVisible()
      expect(await mock.call('orders')).toHaveLength(0)
      await dialog.getByRole('button', { name: 'Revisar novos valores' }).click()
      await dialog.getByRole('button', { name: /Confirmar compra|Tentar novamente/ }).click()
      await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
      expect(await mock.call('orders')).toHaveLength(1)
    })
  })

  test('eventos duplicados ou antigos não regridem o estado', async ({ app, page, mock }) => {
    await app.goto('/nft/sage-nomad-009')
    await mock.waitForSocket()
    const price = page.getByText(/^\d+\.\d+ ETH$/).locator('visible=true').first()
    await expect(price).toHaveText('1.69 ETH')

    await mock.call('updateNft', 'sage-nomad-009', { price: '2.00' })
    await expect(price).toHaveText('2.00 ETH')
    // duplicata exata (mesmo eventId) e evento com versão antiga
    await mock.call('replayLastEvent')
    await mock.call('emitStaleNftEvent', 'sage-nomad-009', '0.01')
    await page.waitForTimeout(500)
    await expect(price).toHaveText('2.00 ETH')
  })

  test.describe('desconexão com pedido pendente', () => {
    test.use({ scenario: 'pagamento-lento' })
    test('recupera o estado após reconectar e após recarregar, sem criar outra compra', async ({ app, page, mock }) => {
      test.slow()
      await app.login('ana')
      await app.addToCart('sage-nomad-009')
      await app.checkoutReady()
      await app.confirmPurchase()
      await expect(page.getByTestId('order-pending')).toBeVisible()

      // queda do Socket.IO enquanto o pedido está pendente
      await mock.call('disconnectRealtime', 4000)
      await expect(page.getByText('Reconectando ao tempo real')).toBeVisible()

      // recarregar no meio: o pedido é recuperado pela API (sem reenvio)
      await page.reload()
      await expect(page.getByTestId('order-pending')).toBeVisible()
      await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 25_000 })
      expect(await mock.call('orders')).toHaveLength(1)

      // estado terminal: voltar ao pagamento não oferece retomar pedido
      await page.goto('/pagamento')
      await expect(page.getByText('Você tem um pedido em processamento.')).toHaveCount(0)
    })
  })
})
