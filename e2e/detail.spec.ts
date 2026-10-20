import { expect, test } from './fixtures'

/** Cenário 2 — acesso direto ao detalhe e tratamento de recurso inexistente. */
test.describe('Detalhe do NFT', () => {
  test('acesso direto exibe galeria, informações e edição selecionável pela URL', async ({ app, page }) => {
    await app.goto('/nft/emerald-ape-042?edicao=1-10')
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Edição 1\/10/ })).toHaveAttribute('aria-checked', 'true')
    // 1/10 custa 1.5x (1.785 → 1.79 ETH)
    await expect(page.getByText('1.79 ETH').locator('visible=true').first()).toBeVisible()
    await page.getByRole('radio', { name: /Edição 1\/50/ }).click()
    await expect(page).not.toHaveURL(/edicao/)
  })

  test('NFT inexistente mostra 404 específico', async ({ app, page }) => {
    await app.goto('/nft/nao-existe-123')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao início' }).click()
    await expect(page).toHaveURL('/')
  })

  test('rota inexistente mostra 404 geral', async ({ app, page }) => {
    await app.goto('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('edição indisponível e limite de quantidade', async ({ app, page }) => {
    await app.goto('/nft/emerald-ape-042')
    // 1/1 está esgotada no seed
    await page.getByRole('radio', { name: /Edição 1\/1,.*indisponível/ }).click()
    await expect(page.getByText('Edição 1/1 esgotada.').locator('visible=true')).toBeVisible()
    await expect(page.getByRole('button', { name: app.isMobile ? 'Esgotado' : 'ESGOTADO', exact: true })).toBeDisabled()

    // 1/10 tem 3 unidades → limite 3
    await page.getByRole('radio', { name: /Edição 1\/10/ }).click()
    const plus = page.getByRole('button', { name: 'Aumentar quantidade' })
    await plus.click()
    await plus.click()
    await expect(page.getByRole('status', { name: 'Quantidade' }).locator('visible=true')).toHaveText('3')
    await expect(plus).toBeDisabled()
    await expect(page.getByText('Restam 3 unidade(s) desta edição.').locator('visible=true')).toBeVisible()
  })

  test('NFT totalmente esgotado não permite compra', async ({ app, page }) => {
    await app.goto('/nft/phantom-ape-000')
    await expect(page.getByRole('button', { name: app.isMobile ? 'Esgotado' : 'ESGOTADO', exact: true })).toBeDisabled()
  })
})
