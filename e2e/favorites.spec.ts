import { expect, test } from './fixtures'

/** Cenário 4 — favoritos, falha de mutation e recuperação do estado. */
test.describe('Favoritos', () => {
  test('visitante é levado ao login e volta para favoritar', async ({ app, page }) => {
    await app.goto('/nft/ivory-baron-088')
    await page.getByRole('button', { name: /^Favoritar/ }).click()
    await expect(page).toHaveURL(/\/entrar\?.*motivo=favoritos/)
  })

  test('atualização otimista persiste após refresh', async ({ app, page }) => {
    await app.login('ana', '/nft/ivory-baron-088')
    const button = page.getByRole('button', { name: /^Favoritar/ })
    await button.click()
    await expect(page.getByRole('button', { name: /Remover dos favoritos|Favoritado/ })).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('button', { name: /Remover dos favoritos|Favoritado/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test.describe('com falha na API', () => {
    test.use({ scenario: 'favoritos-falha' })
    test('faz rollback, avisa o usuário e recupera ao tentar novamente', async ({ app, page, mock }) => {
      await app.login('ana', '/nft/ivory-baron-088')
      await page.getByRole('button', { name: /^Favoritar/ }).click()
      // rollback: volta a "não favoritado" e mostra erro com ação de tentar de novo
      await expect(page.getByText(/Não foi possível favoritar Ivory Baron #088/).first()).toBeVisible()
      await expect(page.getByRole('button', { name: /^Favoritar/ })).toHaveAttribute('aria-pressed', 'false')

      // rede volta ao normal → "Tentar novamente" conclui a operação
      await mock.call('setScenario', 'instantaneo')
      await page.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(page.getByRole('button', { name: /Remover dos favoritos|Favoritado/ })).toHaveAttribute('aria-pressed', 'true')
      await page.reload()
      await expect(page.getByRole('button', { name: /Remover dos favoritos|Favoritado/ })).toHaveAttribute('aria-pressed', 'true')
    })
  })
})
