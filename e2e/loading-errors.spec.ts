import { expect, test } from './fixtures'

/** Cenário 12 — skeletons durante carregamento lento, feedback de falha e recuperação. */
test.describe('Carregamento e falhas', () => {
  test.describe('rede lenta', () => {
    test.use({ scenario: 'lento' })
    test('skeletons com shimmer no catálogo, detalhe e resumo do carrinho', async ({ app, page }) => {
      await app.goto('/')
      await expect(page.getByTestId('catalog-skeleton')).toBeVisible()
      await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('catalog-skeleton')).toHaveCount(0)

      await page.goto('/nft/emerald-ape-042')
      await expect(page.getByTestId('detail-skeleton')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible({ timeout: 15_000 })

      await page.goto('/carrinho')
      await expect(page.getByTestId('cart-skeleton')).toBeVisible()
    })

    test('respeita prefers-reduced-motion (sem animação de shimmer)', async ({ app, page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await app.goto('/')
      const skeleton = page.getByTestId('catalog-skeleton').locator('.skeleton').first()
      await expect(skeleton).toBeVisible()
      expect(await skeleton.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
    })
  })

  test.describe('serviço instável', () => {
    test.use({ scenario: 'instavel' })
    test('após falhas 503 a nova tentativa recupera o catálogo', async ({ app, page }) => {
      await app.goto('/')
      // retries automáticos (2) esgotam → feedback de erro com ação de tentar novamente
      await expect(page.getByRole('heading', { name: 'Não foi possível carregar o catálogo' })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('Serviço temporariamente indisponível.')).toBeVisible()
      await page.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(page.getByTestId('catalog-grid')).toBeVisible()
    })
  })

  test.describe('sem conexão', () => {
    test.use({ scenario: 'offline' })
    test('mostra erro de rede e recupera quando a conexão volta', async ({ app, page, mock }) => {
      await app.goto('/nft/emerald-ape-042')
      await expect(page.getByText('Sem conexão com o servidor. Verifique sua internet.')).toBeVisible({ timeout: 15_000 })
      await mock.call('setScenario', 'instantaneo')
      await page.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
    })
  })

  test.describe('erro 500', () => {
    test.use({ scenario: 'erro-servidor' })
    test('feedback de erro no catálogo', async ({ app, page }) => {
      await app.goto('/')
      await expect(page.getByRole('heading', { name: 'Não foi possível carregar o catálogo' })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('Erro inesperado no servidor.')).toBeVisible()
    })
  })

  test.describe('catálogo vazio', () => {
    test.use({ scenario: 'catalogo-vazio' })
    test('estado vazio', async ({ app, page }) => {
      await app.goto('/')
      await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    })
  })
})
