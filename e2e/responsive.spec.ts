import { expect, test } from './fixtures'

/** Larguras mínimas exigidas (390, 768, 1440): nenhuma rota pode ter overflow horizontal. */
const WIDTHS = [390, 768, 1440]
const PUBLIC = ['/', '/nft/emerald-ape-042', '/carrinho', '/entrar', '/cadastro', '/rota-inexistente']
const PRIVATE = ['/pagamento', '/perfil', '/perfil/carteiras', '/perfil/favoritos']

test.describe('Responsividade', () => {
  test('sem overflow horizontal em 390, 768 e 1440 px', async ({ app, page }) => {
    test.skip(app.isMobile, 'o teste percorre as três larguras a partir do projeto desktop')
    test.slow()
    await app.login('ana')
    await app.addToCart('emerald-ape-042')
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of [...PUBLIC, ...PRIVATE]) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, `${path} em ${width}px`).toBeLessThanOrEqual(0)
      }
    }
  })
})
