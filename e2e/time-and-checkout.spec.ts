import { expect, test, USERS } from './fixtures'

/**
 * Cenários sensíveis a tempo com relógio controlado (`page.clock`): o teste avança o tempo
 * em vez de esperar. O mock usa `Date.now()`/timers da página, então expiração de sessão e
 * liquidação de pedidos obedecem ao relógio do teste.
 */
test.describe('Relógio controlado', () => {
  test.describe('sessão expira durante o checkout', () => {
    test.use({ scenario: 'sessao-curta' })
    test('leva ao login preservando o rascunho e retoma o pagamento', async ({ app, page }) => {
      await page.clock.install()
      await app.login('ana')
      await app.addToCart('sage-nomad-009')
      await page.goto('/pagamento')
      const note = page.getByLabel('Observação do colecionador (opcional)')
      await note.fill('Entregar na carteira principal')

      // sessão de 45 s: avança o relógio além do vencimento
      await page.clock.fastForward('00:46')
      await expect(page).toHaveURL(/\/entrar\?.*motivo=expirada/)
      await expect(page.getByText('Sua sessão expirou').first()).toBeVisible()

      await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
      await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
      await page.getByRole('button', { name: 'Entrar', exact: true }).click()
      await expect(page).toHaveURL('/pagamento')
      // contexto retomado: item no pedido e rascunho do formulário restaurados
      await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue('Entregar na carteira principal')
      await expect(page.getByText('Sage Nomad #009').first()).toBeVisible()
    })
  })

  test.describe('pedido pendente', () => {
    test.use({ scenario: 'pagamento-lento' })
    test('é liquidado quando o tempo de confirmação passa (12 s simulados)', async ({ app, page, mock }) => {
      await page.clock.install()
      await app.login('ana')
      await app.addToCart('sage-nomad-009')
      await app.checkoutReady()
      await app.confirmPurchase()
      await expect(page.getByTestId('order-pending')).toBeVisible()

      await page.clock.fastForward('00:13')
      await expect(page.getByTestId('order-confirmed')).toBeVisible()
      expect(await mock.call('orders')).toHaveLength(1)
    })
  })
})

test.describe('Edição esgotada no envio do pedido', () => {
  test.use({ scenario: 'edicao-esgotada' })
  test('o servidor rejeita, a revisão mostra a indisponibilidade e bloqueia a confirmação', async ({ app, page, mock }) => {
    await app.login('ana')
    await app.addToCart('sage-nomad-009')
    await app.checkoutReady()
    const dialog = await app.confirmPurchase()

    // 409 QUOTE_STALE: a edição esgotou no momento do envio
    await expect(dialog.getByRole('alert').filter({ hasText: 'Preço, disponibilidade ou taxas mudaram' })).toBeVisible()
    await expect(dialog.getByText('Os valores mudaram desde a sua revisão.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Revisar novos valores' }).click()

    await expect(dialog.getByText('Há itens indisponíveis no pedido.')).toBeVisible()
    await expect(dialog.getByText(/Sage Nomad #009 \(1\/50\) esgotou/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Confirmar compra|Tentar novamente/ })).toBeDisabled()
    expect(await mock.call('orders')).toHaveLength(0)

    await dialog.getByRole('link', { name: 'Ajustar carrinho' }).click()
    await expect(page).toHaveURL('/carrinho')
    await expect(page.getByText('Esta edição esgotou. Remova o item para continuar.').first()).toBeVisible()
  })
})
