import { expect, test } from './fixtures'

/** Cenário 6 — compra completa, do catálogo ao recibo confirmado. */
test.describe('Compra completa', () => {
  test('do catálogo ao recibo, removendo do carrinho só o que foi comprado', async ({ app, page, mock }) => {
    await app.goto('/')
    await page.getByTestId('catalog-grid').getByRole('link', { name: 'Emerald Ape #042', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await page.getByRole('button', { name: app.isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
    await page.waitForURL('**/carrinho')
    await expect(page.getByTestId('total')).toHaveText('2.396 ETH')

    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/entrar/)
    await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.dev')
    await page.getByLabel('Senha', { exact: true }).fill('Kurio@2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/pagamento')
    await mock.waitForSocket(true)

    await page.getByRole('radio', { name: 'MetaMask' }).check()
    await expect(page.getByRole('button', { name: /Conectada/ })).toBeVisible()
    // revisão mostra o total da cotação antes do envio
    await app.confirmPurchase('2.396 ETH')

    await expect(page).toHaveURL(/\/pedidos\//)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    // confirmação chega pelo Socket.IO (order.updated) e o recibo vem do REST
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    await expect(page.getByRole('cell', { name: /Emerald Ape #042/ })).toBeVisible()
    await expect(page.getByRole('cell', { name: '(x 2)' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Ver no Etherscan/ })).toHaveAttribute('href', /etherscan\.io\/tx\/0x[0-9a-f]{64}/)

    // recibo é snapshot: mudar o catálogo depois não altera os valores
    await mock.call('updateNft', 'emerald-ape-042', { price: '9.99' })
    await page.reload()
    await expect(page.getByTestId('order-confirmed')).toContainText('2.396 ETH')

    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })
})
