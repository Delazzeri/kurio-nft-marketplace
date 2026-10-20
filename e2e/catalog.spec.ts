import { expect, test } from './fixtures'

/** Cenário 1 — busca, filtros combinados, ordenação, paginação e restauração pelo histórico. */
test.describe('Catálogo', () => {
  test('busca, filtros combinados, ordenação e paginação compõem a URL e sobrevivem a refresh/histórico', async ({ app, page }) => {
    await app.goto('/')
    const grid = page.getByTestId('catalog-grid')
    await expect(grid.getByRole('article')).toHaveCount(9)

    // paginação
    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    // filtro reinicia a paginação
    if (app.isMobile) await page.getByRole('button', { name: /Filtros e ordenação/ }).click()
    const filters = app.isMobile ? page.getByRole('dialog', { name: 'Filtros' }) : page.getByRole('complementary', { name: 'Filtros' })
    await filters.getByRole('button', { name: /^Música/ }).click()
    await expect(page).not.toHaveURL(/page=2/)
    await expect(page).toHaveURL(/cat=musica/)

    // filtros combináveis (categoria + rede)
    await filters.getByRole('button', { name: /^Ethereum/ }).click()
    await expect(page).toHaveURL(/net=ethereum/)
    await expect(filters.getByRole('button', { name: /^Música/ })).toHaveAttribute('aria-pressed', 'true')

    // ordenação
    await page.getByRole('combobox', { name: 'Ordenar por:' }).click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect(page).toHaveURL(/sort=price-asc/)
    if (app.isMobile) await page.getByRole('dialog', { name: 'Filtros' }).getByRole('button', { name: 'Fechar' }).click()

    // Golden Signal (0.39) é o mais barato de Música + Ethereum
    await expect(grid.getByRole('heading', { level: 3 }).first()).toHaveText('Golden Signal #160')

    // refresh preserva o estado
    await page.reload()
    await expect(page).toHaveURL(/cat=musica/)
    await expect(grid.getByRole('heading', { level: 3 }).first()).toHaveText('Golden Signal #160')

    // histórico: voltar desfaz a ordenação
    await page.goBack()
    await expect(page).not.toHaveURL(/sort=price-asc/)
    await expect(page).toHaveURL(/net=ethereum/)
  })

  test('busca textual reflete os parâmetros enviados à API e trata resultado vazio', async ({ app, page }) => {
    const requests: string[] = []
    page.on('request', (r) => r.url().includes('/api/nfts?') && requests.push(r.url()))
    await app.goto('/?q=golden')
    // Golden Beat, Golden Frequency, Golden Signal e Golden Static
    await expect(page.getByTestId('catalog-grid').getByRole('article')).toHaveCount(4)
    expect(requests.some((u) => new URL(u).searchParams.get('q') === 'golden')).toBe(true)

    await app.goto('/?q=inexistente-xyz')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Limpar filtros' }).click()
    await expect(page.getByTestId('catalog-grid').getByRole('article')).toHaveCount(9)
  })

  test('parâmetros inválidos na URL são descartados sem quebrar a página', async ({ app, page }) => {
    await app.goto('/?page=abc&sort=foo&cat=nada&min=-1')
    await expect(page.getByTestId('catalog-grid').getByRole('article')).toHaveCount(9)
  })

  test.describe('com respostas fora de ordem', () => {
    test.use({ scenario: 'latencia-variavel' })
    test('a grade mostra sempre o resultado dos parâmetros mais recentes', async ({ app, page }) => {
      test.skip(app.isMobile, 'mesma lógica de cache; validado no desktop')
      await app.goto('/')
      await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 15_000 })
      const filters = page.getByRole('complementary', { name: 'Filtros' })
      // cliques rápidos: respostas lentas anteriores não podem sobrescrever a última
      await filters.getByRole('button', { name: /^Fotografia/ }).click()
      await filters.getByRole('button', { name: /^Fotografia/ }).click()
      await filters.getByRole('button', { name: /^Música/ }).click()
      await expect(page).toHaveURL(/cat=musica/)
      await expect(page.getByTestId('catalog-grid')).not.toHaveClass(/opacity-60/, { timeout: 15_000 })
      const names = await page.getByTestId('catalog-grid').getByRole('heading', { level: 3 }).allTextContents()
      expect(names.every((n) => /Golden|Citrus/.test(n))).toBe(true)
    })
  })
})
