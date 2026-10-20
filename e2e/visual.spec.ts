import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/** Regressão visual com dados estáveis (seed determinístico, cenário instantâneo). */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].filter((i) => !i.complete && i.loading !== 'lazy').map((i) => new Promise((r) => (i.onload = i.onerror = r))))
  })
  await page.waitForTimeout(300)
}

test.describe('Regressão visual', () => {
  test('início', async ({ app, page }) => {
    await app.goto('/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('inicio.png')
  })

  test('detalhe', async ({ app, page }) => {
    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png')
  })

  test('carrinho', async ({ app, page }) => {
    await app.addToCart('emerald-ape-042', { quantity: 2 })
    await app.addToCart('ivory-baron-088', { goToCart: true })
    await expect(page.getByTestId('total')).toHaveText('4.186 ETH')
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png')
  })

  test('pagamento', async ({ app, page }) => {
    await app.login('ana')
    await app.addToCart('emerald-ape-042', { quantity: 2 })
    await page.goto('/pagamento')
    await expect(page.getByTestId('total')).toHaveText('2.396 ETH')
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png')
  })
})
