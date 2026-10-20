import { expect, test } from './fixtures'

/** Cenário 5 — carrinho, quantidades, remoção, cupom e persistência após refresh/login. */
test.describe('Carrinho', () => {
  test('quantidades, remoção e resumo coerente com a API', async ({ app, page }) => {
    await app.addToCart('emerald-ape-042', { quantity: 2 })
    await app.addToCart('ivory-baron-088', { goToCart: true })

    await expect(page.getByTestId('subtotal')).toHaveText('4.17 ETH') // 2×1.19 + 1.79
    await expect(page.getByTestId('network-fee')).toContainText('0.016 ETH')
    await expect(page.getByTestId('total')).toHaveText('4.186 ETH')

    await page.getByRole('group', { name: 'Quantidade de Ivory Baron #088' }).getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(page.getByTestId('total')).toHaveText('5.976 ETH')

    await page.getByRole('button', { name: 'Remover Emerald Ape #042 do carrinho' }).click()
    await expect(page.getByTestId('cart-item-emerald-ape-042')).toHaveCount(0)
    await expect(page.getByTestId('total')).toHaveText('3.596 ETH')
    await expect(page.getByTestId('live-polite')).toContainText('removido do carrinho')

    await page.reload()
    await expect(page.getByTestId('total')).toHaveText('3.596 ETH')
  })

  test('cupom inválido, expirado, aplicação e remoção', async ({ app, page }) => {
    await app.addToCart('velvet-monarch-077', { goToCart: true }) // 3.10
    const input = page.getByLabel('Código promocional')

    await input.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Código promocional inválido.' })).toBeVisible()
    await expect(input).toHaveAttribute('aria-invalid', 'true')

    await input.fill('VERAO2025')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Este código promocional expirou.' })).toBeVisible()

    await input.fill('kurio10')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByText('Cupom KURIO10 aplicado').first()).toBeVisible()
    await expect(page.getByTestId('discount')).toHaveText('(-) 0.31 ETH')
    await expect(page.getByTestId('total')).toHaveText('2.806 ETH') // 3.10 − 0.31 + 0.016

    await page.reload()
    await expect(page.getByTestId('discount')).toHaveText('(-) 0.31 ETH')
    await page.getByRole('button', { name: 'Remover cupom KURIO10' }).click()
    await expect(page.getByTestId('total')).toHaveText('3.116 ETH')
  })

  test('itens do visitante são preservados ao autenticar', async ({ app, page }) => {
    await app.addToCart('golden-beat-207', { goToCart: true })
    await expect(page.getByTestId('cart-item-golden-beat-207')).toBeVisible()
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/entrar/)
    await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.dev')
    await page.getByLabel('Senha', { exact: true }).fill('Kurio@2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/pagamento')
    await expect(page.getByText('Golden Beat #207').first()).toBeVisible()
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-item-golden-beat-207')).toBeVisible()
  })

  test('respeita disponibilidade por edição', async ({ app, page }) => {
    // 1/10 do Emerald tem 3 unidades
    await app.goto('/nft/emerald-ape-042?edicao=1-10')
    const plus = page.getByRole('button', { name: 'Aumentar quantidade' })
    await plus.click()
    await plus.click()
    await page.getByRole('button', { name: app.isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
    await page.waitForURL('**/carrinho')
    await expect(page.getByRole('group', { name: 'Quantidade de Emerald Ape #042' }).getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()
  })
})
