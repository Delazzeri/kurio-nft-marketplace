import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'

/** Cenário 11 — navegação por teclado, foco de diálogos e validação de formulários. */
test.describe('Acessibilidade', () => {
  test('link para pular conteúdo e foco visível na navegação por teclado', async ({ app, page }) => {
    test.skip(app.isMobile, 'navegação por teclado validada no desktop')
    await app.goto('/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()

    // filtros operáveis por teclado
    const music = page.getByRole('complementary', { name: 'Filtros' }).getByRole('button', { name: /^Música/ })
    await music.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/cat=musica/)
    await expect(music).toHaveAttribute('aria-pressed', 'true')
  })

  test('diálogo de zoom prende o foco e devolve ao fechar', async ({ app, page }) => {
    test.skip(app.isMobile, 'zoom disponível na galeria desktop')
    await app.goto('/nft/emerald-ape-042')
    const trigger = page.getByRole('button', { name: 'Ampliar imagem' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Emerald Ape #042' })
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('drawer de filtros no mobile controla o foco', async ({ app, page }) => {
    test.skip(!app.isMobile, 'drawer é do layout mobile')
    await app.goto('/')
    const opener = page.getByRole('button', { name: /Filtros e ordenação/ })
    await opener.click()
    const drawer = page.getByRole('dialog', { name: 'Filtros' })
    await expect(drawer).toBeVisible()
    expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test('erros de formulário ficam associados aos campos', async ({ app, page }) => {
    await app.goto('/entrar')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = page.getByLabel('E-mail', { exact: true })
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText('Informe seu e-mail')
    // foco vai para o primeiro campo inválido
    await expect(email).toBeFocused()
  })

  for (const path of ['/', '/nft/emerald-ape-042', '/carrinho', '/entrar']) {
    test(`sem violações críticas do axe em ${path}`, async ({ app, page }) => {
      await app.goto(path)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('[aria-label^="Abrir painel de cenários"]').analyze()
      const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([])
    })
  }
})
